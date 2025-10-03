// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * StakingVault (BaseTC) — Weighted Locks, Relayer-Gated (user pays gas)
 *
 * Tujuan:
 * - User stake $BaseTC untuk jangka 7/30/365 hari.
 * - Reward dari leftover GameCore via RewardsVault.payout ke kontrak ini.
 * - Distribusi reward pakai index global (accRewardPerWeight) + SKIM dana baru.
 * - Semua aksi (stake/harvest/unstake) via UI dengan relayer signature (RELAYER_ROLE),
 *   tx tetap dikirim user (user bayar gas).
 *
 * Catatan:
 * - Early-unstake penalty opsional (default aktif 10%).
 * - Durasi & weight bisa diubah MANAGER_ROLE.
 */

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract StakingVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    // --- Roles ---
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    IERC20 public immutable token; // BaseTC

    // --- Accounting (skim total balance) ---
    uint256 public accountedBalance; // principal + rewards yang belum dibayar

    // --- Lock configs ---
    struct LockConf { uint32 duration; uint32 weightBps; } // 10000 = 1.0x
    LockConf public lock7d   = LockConf(7 days,   10000);  // 1.0x
    LockConf public lock30d  = LockConf(30 days,  12000);  // 1.2x
    LockConf public lock365d = LockConf(365 days, 15000);  // 1.5x

    // --- Position ---
    struct Position {
        uint128 amount;      // principal
        uint128 weight;      // amount * weightBps / 1e4
        uint64  unlockAt;    // unix ts
        uint128 rewards;     // accumulated (pending)
        uint128 lastAccIdx;  // last index consumed (scaled 1e18)
    }

    mapping(address => Position) public pos;

    uint128 public totalWeight;    // sum of all positions' weight
    uint128 public accRewardPerW;  // global index scaled by 1e18

    // --- Early-unstake penalty (optional) ---
    uint16  public earlyPenaltyBps = 1000;      // default 10%
    address public penaltyTreasury;             // if zero, penalty stays in vault

    event EarlyUnstake(address indexed user, uint256 amount, uint256 penalty);

    function setEarlyPenalty(uint16 bps, address treasury) external onlyRole(MANAGER_ROLE) {
        require(bps <= 5000, "MAX_50%");
        earlyPenaltyBps = bps;
        penaltyTreasury = treasury; // zero => add to pool
    }

    // --- EIP712 ---
    bytes32 private immutable _DOMAIN_SEPARATOR;
    string  public constant EIP712_NAME    = "StakingVault";
    string  public constant EIP712_VERSION = "1";

    // action typehashes
    bytes32 public constant STAKE_TYPEHASH   = keccak256("StakeAction(address user,uint256 amount,uint8 lockType,uint256 nonce,uint256 deadline)");
    bytes32 public constant HARVEST_TYPEHASH = keccak256("HarvestAction(address user,uint256 nonce,uint256 deadline)");
    bytes32 public constant UNSTAKE_TYPEHASH = keccak256("UnstakeAction(address user,uint256 amount,uint256 nonce,uint256 deadline)");

    mapping(address => uint256) public nonces; // single rolling nonce per user

    // --- Events ---
    event Skimmed(uint256 amount);
    event LockConfigSet(LockConf lock7d, LockConf lock30d, LockConf lock365d);
    event Staked(address indexed user, uint256 amount, uint8 lockType, uint256 weight, uint256 unlockAt);
    event Harvest(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event Rescue(address to, uint256 amount);

    constructor(IERC20 baseTc, address admin) {
        token = baseTc;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MANAGER_ROLE, admin);
        _grantRole(RELAYER_ROLE, admin);

        _DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(EIP712_NAME)),
                keccak256(bytes(EIP712_VERSION)),
                block.chainid,
                address(this)
            )
        );
    }

    // ===== Admin =====
    function setLocks(LockConf calldata a, LockConf calldata b, LockConf calldata c) external onlyRole(MANAGER_ROLE) {
        require(a.duration>0 && b.duration>0 && c.duration>0, "DUR");
        require(a.weightBps>0 && b.weightBps>0 && c.weightBps>0, "BPS");
        lock7d=a; lock30d=b; lock365d=c;
        emit LockConfigSet(a,b,c);
    }

    function grantRelayer(address r) external onlyRole(DEFAULT_ADMIN_ROLE) { _grantRole(RELAYER_ROLE, r); }
    function revokeRelayer(address r) external onlyRole(DEFAULT_ADMIN_ROLE) { _revokeRole(RELAYER_ROLE, r); }

    function rescue(address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(amount <= accountedBalance, "EXCEEDS");
        accountedBalance -= amount;
        token.safeTransfer(to, amount);
        emit Rescue(to, amount);
    }

    // ===== Internals =====
    function _skim() internal returns (uint256 newly) {
        uint256 bal = token.balanceOf(address(this));
        if (bal > accountedBalance) {
            newly = bal - accountedBalance;
            accountedBalance = bal;
            emit Skimmed(newly);
        }
    }

    function _updateIndex() internal {
        uint256 newly = _skim();
        if (newly == 0 || totalWeight == 0) return;
        // acc += newly / totalWeight (scaled 1e18)
        uint256 add = (newly * 1e18) / uint256(totalWeight);
        accRewardPerW = uint128(uint256(accRewardPerW) + add);
    }

    /// Keeper hook: panggil setelah inflow leftover agar fair.
    function poke() external nonReentrant {
        _updateIndex();
    }

    function _lockConf(uint8 lockType) internal view returns (LockConf memory c) {
        if (lockType == 1) return lock7d;
        if (lockType == 2) return lock30d;
        if (lockType == 3) return lock365d;
        revert("lockType");
    }

    function _pending(Position memory p) internal view returns (uint256) {
        if (p.weight == 0) return p.rewards;
        uint256 delta = uint256(accRewardPerW) - uint256(p.lastAccIdx);
        return p.rewards + (uint256(p.weight) * delta) / 1e18;
    }

    // ===== Views =====
    function pending(address u) external view returns (uint256) {
        Position memory p = pos[u];
        return _pending(p);
    }

    // ===== Signature helpers (kurangi depth) =====
    function _verifyStakeSig(
        address user,
        uint256 amount,
        uint8 lockType,
        uint256 nonce,
        uint256 deadline,
        bytes calldata relayerSig
    ) internal view {
        require(msg.sender == user, "ONLY_SELF");
        require(block.timestamp <= deadline, "SIG_EXPIRED");
        require(nonce == nonces[user], "BAD_NONCE");
        bytes32 digest = keccak256(abi.encodePacked(
            "\x19\x01",
            _DOMAIN_SEPARATOR,
            keccak256(abi.encode(STAKE_TYPEHASH, user, amount, lockType, nonce, deadline))
        ));
        address signer = ECDSA.recover(digest, relayerSig);
        require(hasRole(RELAYER_ROLE, signer), "BAD_RELAYER_SIG");
    }

    function _verifyHarvestSig(
        address user,
        uint256 nonce,
        uint256 deadline,
        bytes calldata relayerSig
    ) internal view {
        require(msg.sender == user, "ONLY_SELF");
        require(block.timestamp <= deadline, "SIG_EXPIRED");
        require(nonce == nonces[user], "BAD_NONCE");
        bytes32 digest = keccak256(abi.encodePacked(
            "\x19\x01",
            _DOMAIN_SEPARATOR,
            keccak256(abi.encode(HARVEST_TYPEHASH, user, nonce, deadline))
        ));
        address signer = ECDSA.recover(digest, relayerSig);
        require(hasRole(RELAYER_ROLE, signer), "BAD_RELAYER_SIG");
    }

    function _verifyUnstakeSig(
        address user,
        uint256 amount,
        uint256 nonce,
        uint256 deadline,
        bytes calldata relayerSig
    ) internal view {
        require(msg.sender == user, "ONLY_SELF");
        require(block.timestamp <= deadline, "SIG_EXPIRED");
        require(nonce == nonces[user], "BAD_NONCE");
        bytes32 digest = keccak256(abi.encodePacked(
            "\x19\x01",
            _DOMAIN_SEPARATOR,
            keccak256(abi.encode(UNSTAKE_TYPEHASH, user, amount, nonce, deadline))
        ));
        address signer = ECDSA.recover(digest, relayerSig);
        require(hasRole(RELAYER_ROLE, signer), "BAD_RELAYER_SIG");
    }

    // ===== Small helpers (pecah logika untuk kurangi stack) =====
    function _harvestIfAny(address user) internal returns (uint256 paid) {
        Position storage p = pos[user];
        if (p.weight == 0) {
            return 0;
        }
        Position memory pm = p; // copy for _pending
        uint256 amt = _pending(pm);
        if (amt > 0) {
            p.rewards = 0;
            require(amt <= accountedBalance, "INSUFFICIENT");
            accountedBalance -= amt;
            token.safeTransfer(user, amt);
            emit Harvest(user, amt);
        }
        p.lastAccIdx = uint128(accRewardPerW);
        return amt;
    }

    function _reducePosition(Position storage p, uint256 amount) internal returns (uint256 wOut) {
        uint256 oldAmt = p.amount;
        uint256 oldW = p.weight;
        wOut = (oldW * amount) / oldAmt;
        p.amount = uint128(oldAmt - amount);
        p.weight = uint128(oldW - wOut);
        p.lastAccIdx = uint128(accRewardPerW);
        totalWeight -= uint128(wOut);
    }

    function _applyPenaltyAndPayout(address user, uint256 amount, bool early) internal {
        uint256 net = amount;
        uint256 penalty = 0;

        if (early && earlyPenaltyBps > 0) {
            penalty = (amount * earlyPenaltyBps) / 10_000;
            net = amount - penalty;

            if (penaltyTreasury != address(0)) {
                require(penalty <= accountedBalance, "INSUFFICIENT");
                accountedBalance -= penalty;
                token.safeTransfer(penaltyTreasury, penalty);
            } else {
                // penalty stay in vault → jadi tambahan pool (tetap di accountedBalance)
                _updateIndex(); // mengikuti pola sebelumnya
            }
            emit EarlyUnstake(user, amount, penalty);
        }

        require(net <= accountedBalance, "INSUFFICIENT");
        accountedBalance -= net;
        token.safeTransfer(user, net);
        emit Unstaked(user, amount);
    }

    // ===== Relayer-gated actions (user pays gas) =====
    function stakeWithSig(
        address user,
        uint256 amount,
        uint8 lockType,
        uint256 nonce,
        uint256 deadline,
        bytes calldata relayerSig
    ) external nonReentrant {
        _verifyStakeSig(user, amount, lockType, nonce, deadline, relayerSig);

        _updateIndex();

        Position storage p = pos[user];
        if (p.weight > 0) {
            // harvest ke storage
            p.rewards = uint128(_pending(p));
        }

        LockConf memory c = _lockConf(lockType);
        uint256 w = (amount * c.weightBps) / 1e4;

        // pull tokens (needs prior approval)
        token.safeTransferFrom(user, address(this), amount);
        accountedBalance += amount; // principal diakui

        p.amount += uint128(amount);
        p.weight += uint128(w);
        p.unlockAt = uint64(block.timestamp + c.duration);
        p.lastAccIdx = uint128(accRewardPerW);
        totalWeight += uint128(w);

        nonces[user]++;
        emit Staked(user, amount, lockType, w, p.unlockAt);
    }

    function harvestWithSig(
        address user,
        uint256 nonce,
        uint256 deadline,
        bytes calldata relayerSig
    ) external nonReentrant {
        _verifyHarvestSig(user, nonce, deadline, relayerSig);

        _updateIndex();
        Position storage p = pos[user];
        require(p.weight > 0, "NO_POS");
        Position memory pm = p;
        uint256 amt = _pending(pm);
        require(amt > 0, "NO_REWARDS");

        p.rewards = 0;
        p.lastAccIdx = uint128(accRewardPerW);

        require(amt <= accountedBalance, "INSUFFICIENT");
        accountedBalance -= amt;
        token.safeTransfer(user, amt);

        nonces[user]++;
        emit Harvest(user, amt);
    }

    function unstakeWithSig(
        address user,
        uint256 amount,
        uint256 nonce,
        uint256 deadline,
        bytes calldata relayerSig
    ) external nonReentrant {
        _verifyUnstakeSig(user, amount, nonce, deadline, relayerSig);

        _updateIndex();

        Position storage p = pos[user];
        require(amount <= p.amount, "AMOUNT");

        bool early = block.timestamp < p.unlockAt;

        // auto-harvest pending sebelum release principal
        _harvestIfAny(user);

        // kurangi posisi & totalWeight
        _reducePosition(p, amount);

        // penalty (opsional) + payout principal
        _applyPenaltyAndPayout(user, amount, early);

        nonces[user]++;
    }
}

