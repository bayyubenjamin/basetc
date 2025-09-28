// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @dev Minimal interface dari RigNFT (harus panggil onRigBalanceWillChange di GameCore sebelum balance berubah)
interface IRigNFT {
    function BASIC() external view returns (uint256);
    function PRO() external view returns (uint256);
    function LEGEND() external view returns (uint256);

    function balanceOf(address account, uint256 id) external view returns (uint256);

    // (opsional untuk fitur merge)
    function burnFrom(address account, uint256 id, uint256 amount) external;
    function mintByGame(address to, uint256 id, uint256 amount) external;
}

/// @dev Vault untuk bayar hadiah & burn sisa pool
interface IRewardsVault {
    function payout(address to, uint256 amount) external;
    function burn(uint256 amount) external;
}

/**
 * @title BaseTC GameCore v3 (Accumulator ROI + Rig Caps + Merge Fee)
 * @notice
 *  - Reward harian = FIXED per NFT (ROI-style), diakru per detik saat user aktif (miningActive).
 *  - Tidak ada pro-rata pool hashrate. Tidak ada accPerHash.
 *  - Sisa emisi harian yang tidak TERAKRU (karena user tidak aktif) → leftover:
 *      50% burn / 30% staking / 10% spin / 10% leaderboard.
 *  - Atribusi payout harian ke epoch yang benar (distributedAt[e]) saat settle (claim/stop/hook).
 *  - Start/Claim via EIP-712 WithSig (relayer otorisasi, user bayar gas).
 *  - Sesi 24h (ritual harian) + cooldown start/stop (dalam satuan epoch/hari).
 *  - Rig caps: Basic=10, Pro=5, Legend=3 (configurable) + miningUsage(address).
 *  - Baru: biaya merge dibayar pakai ERC20 (configurable).
 */
contract GameCore is AccessControl, ReentrancyGuard {
    using ECDSA for bytes32;

    // =======================
    // Roles
    // =======================
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    bytes32 public constant PARAM_ADMIN  = keccak256("PARAM_ADMIN");

    // =======================
    // External contracts
    // =======================
    IRigNFT public immutable rig;
    IRewardsVault public immutable vault;

    // Cached token IDs
    uint256 private immutable BASIC;
    uint256 private immutable PRO;
    uint256 private immutable LEGEND;

    // =======================
    // Epoch & Halving (per hari)
    // =======================
    uint256 public startTime;             // unix start
    uint256 public epochLength;           // seconds; disarankan 86400
    uint256 public initialRewardPerEpoch; // total EMISI per HARI (untuk perhitungan leftover/budget)
    uint256 public halvingEvery;          // jumlah epoch per halving; disarankan 30 (≈ 30 hari)

    // =======================
    // Base reward per NFT/epoch (sebelum halving)
    // =======================
    struct BaseParams { uint256 b; uint256 p; uint256 l; } // token/epoch per NFT
    // contoh default: 0.333 / 1.000 / 5.000 token per hari (18 desimal)
    BaseParams public baseRw = BaseParams(0.333 ether, 1 ether, 5 ether);

    // ===== NEW: Rig caps (berapa NFT per tier yang dihitung) =====
    struct RigCaps { uint256 b; uint256 p; uint256 l; }
    RigCaps public rigCaps = RigCaps(10, 5, 3);
    event RigCapsSet(uint256 basicCap, uint256 proCap, uint256 legendCap);

    // =======================
    // Session 24h + Cooldown + Prelaunch
    // =======================
    uint256 public sessionDuration = 24 hours;
    mapping(address => uint256) public sessionEndAt;

    uint256 public toggleCooldown = 1; // dalam epoch (hari)
    mapping(address => uint256) public lastToggleEpoch;

    bool public goLive; // jika true: prelaunch sampai masuk epoch 1

    // =======================
    // State per user (accumulator ROI)
    // =======================
    mapping(address => bool)    public miningActive;
    mapping(address => uint256) public lastAccrueTs; // timestamp terakhir disettle (dibayar atau diakru)
    // Catatan: tidak menyimpan "accrued" — claim menghitung dari lastAccrueTs hingga now.

    // =======================
    // Leftover bookkeeping per-epoch (harian)
    // =======================
    mapping(uint256 => uint256) public distributedAt;  // total payout yg DIATRIBUSI ke epoch tsb (berdasarkan akrual waktu itu)
    mapping(uint256 => bool)    public leftoverClosed; // guard: leftover hanya 1x/epoch

    // BPS leftover: 50% burn / 30% staking / 10% spin / 10% leaderboard
    uint16 public leftoverBurnBps  = 5000;
    uint16 public leftoverStakeBps = 3000;
    uint16 public leftoverSpinBps  = 1000;
    uint16 public leftoverBoardBps = 1000;

    address public stakingVault;   // tujuan 30%
    address public spinVault;      // tujuan 10%
    address public boardVault;     // tujuan 10%

    // =======================
    // Merge Fee (ERC20)
    // =======================
    IERC20  public mergeFeeToken;       // token bayar biaya merge
    address public mergeFeeTreasury;    // penampung fee
    uint256 public feeBasicToPro;       // jumlah token fee untuk Basic→Pro
    uint256 public feeProToLegend;      // jumlah token fee untuk Pro→Legend

    event MergeFeeTokenSet(address token);
    event MergeFeeTreasurySet(address treasury);
    event MergeFeeSet(uint256 feeBasicToPro, uint256 feeProToLegend);

    // =======================
    // EIP-712 (relayer signature; user submits tx)
    // =======================
    bytes32 private immutable _DOMAIN_SEPARATOR;
    bytes32 public constant ACTION_TYPEHASH =
        keccak256("UserAction(address user,uint8 action,uint256 nonce,uint256 deadline)");
    string  public constant EIP712_NAME    = "GameCore";
    string  public constant EIP712_VERSION = "1";
    mapping(address => uint256) public nonces;

    enum Action { Start, Stop, Claim }

    // =======================
    // Merge constants (opsional)
    // =======================
    uint256 public constant BASIC_TO_PRO_NEED  = 10;
    uint256 public constant PRO_TO_LEGEND_NEED = 5;

    // =======================
    // Events
    // =======================
    event MiningStarted(address indexed user, uint256 epoch);
    event MiningStopped(address indexed user, uint256 epoch);
    event ToggleCooldownSet(uint256 value);
    event GoLiveSet(bool value);

    event Merged(address indexed user, uint256 indexed fid, uint256 fromId, uint256 toId, uint256 need);
    event Claimed(uint256 indexed e, address indexed user, uint256 amount);
    event LeftoverDistributed(uint256 indexed e, uint256 total, uint256 burnAmt, uint256 stakeAmt, uint256 spinAmt, uint256 boardAmt);

    // =======================
    // Constructor
    // =======================
    constructor(
        address rigNFT,
        address rewardsVault,
        uint256 _startTime,
        uint256 _epochLength,
        uint256 _initialRewardPerEpoch,
        uint256 _halvingEvery
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PARAM_ADMIN, msg.sender);

        rig   = IRigNFT(rigNFT);
        vault = IRewardsVault(rewardsVault);

        BASIC  = rig.BASIC();
        PRO    = rig.PRO();
        LEGEND = rig.LEGEND();

        startTime             = _startTime;
        epochLength           = _epochLength;            // disarankan 86400
        initialRewardPerEpoch = _initialRewardPerEpoch;  // per HARI (budget/leftover)
        halvingEvery          = _halvingEvery;           // disarankan 30

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

    // =======================
    // View helpers
    // =======================
    function epochNow() public view returns (uint256) {
        require(block.timestamp >= startTime, "NOT_STARTED");
        return (block.timestamp - startTime) / epochLength;
    }

    function _epochAtTs(uint256 ts) internal view returns (uint256) {
        if (ts <= startTime) return 0;
        return (ts - startTime) / epochLength;
    }

    function rewardPerEpoch(uint256 e) public view returns (uint256) {
        if (halvingEvery == 0) return initialRewardPerEpoch;
        uint256 halvings = e / halvingEvery;      // setiap N epoch, /2
        return initialRewardPerEpoch >> halvings; // / 2^halvings
    }

    function isPrelaunch() public view returns (bool) {
        if (!goLive) return false;
        if (block.timestamp < startTime) return true;
        uint256 e = _epochAtTs(block.timestamp);
        return (e < 1);
    }

    // ===== Raw NFT balances =====
    function _balances(address u) internal view returns (uint256 b, uint256 p, uint256 l) {
        b = rig.balanceOf(u, BASIC);
        p = rig.balanceOf(u, PRO);
        l = rig.balanceOf(u, LEGEND);
    }

    // ===== NEW: capped usage =====
    function _usage(address u)
        internal
        view
        returns (
            uint256 bOwned, uint256 pOwned, uint256 lOwned,
            uint256 bUsed,  uint256 pUsed,  uint256 lUsed
        )
    {
        (bOwned, pOwned, lOwned) = _balances(u);
        bUsed = bOwned < rigCaps.b ? bOwned : rigCaps.b;
        pUsed = pOwned < rigCaps.p ? pOwned : rigCaps.p;
        lUsed = lOwned < rigCaps.l ? lOwned : rigCaps.l;
    }

    /// @notice UI helper untuk badge: mengembalikan owned/used/idle per tier.
    function miningUsage(address u)
        external
        view
        returns (
            uint256 bOwned, uint256 bUsed, uint256 bIdle,
            uint256 pOwned, uint256 pUsed, uint256 pIdle,
            uint256 lOwned, uint256 lUsed, uint256 lIdle
        )
    {
        (bOwned, pOwned, lOwned, bUsed, pUsed, lUsed) = _usage(u);
        bIdle = bOwned > bUsed ? (bOwned - bUsed) : 0;
        pIdle = pOwned > pUsed ? (pOwned - pUsed) : 0;
        lIdle = lOwned > lUsed ? (lOwned - lUsed) : 0;
    }

    // ===== Base per-day (fixed ROI) at epoch e (with halving) — uses *used* counts =====
    function _basePerDayAtEpoch(address u, uint256 e) internal view returns (uint256) {
        (, , , uint256 bUsed, uint256 pUsed, uint256 lUsed) = _usage(u);

        unchecked {
            uint256 perDay = bUsed * baseRw.b + pUsed * baseRw.p + lUsed * baseRw.l; // token/epoch
            if (halvingEvery == 0) return perDay;
            uint256 halvings = e / halvingEvery;
            return perDay >> halvings; // / 2^halvings
        }
    }

    function _perSecAtEpoch(address u, uint256 e) internal view returns (uint256) {
        uint256 perDay = _basePerDayAtEpoch(u, e);
        return epochLength == 0 ? 0 : perDay / epochLength; // flooring
    }

    // ===== Display helpers (untuk kompat UI lama) =====
    function getHashrate(address /*u*/) external pure returns (uint256) {
        // Tidak dipakai untuk reward lagi; kembalikan 0 agar UI lama tidak bingung.
        return 0;
    }

    function getBaseUnit(address u) external view returns (uint256) {
        // Base per epoch (setelah halving hari INI) berdasarkan *used* (sudah di-cap).
        return _basePerDayAtEpoch(u, epochNow());
    }

    function isSupreme(address u) external view returns (bool) {
        (uint256 b, uint256 p, uint256 l) = _balances(u);
        return (b >= 10 && p >= 5 && l >= 3);
    }

    // =======================
    // Internal: settle accrual (segment per epoch)
    // =======================
    /// @dev Settle akrual dari fromTs hingga toTs (capped ke sessionEndAt bila aktif), tulis distributedAt per-epoch.
    function _settleAccrual(address u, uint256 fromTs, uint256 toTs) internal returns (uint256 paid, uint256 lastTs) {
        if (toTs <= fromTs) return (0, fromTs);

        uint256 cur = fromTs;
        uint256 endCap = toTs;

        // Jika aktif, batasi ke akhir sesi
        if (miningActive[u]) {
            uint256 endSession = sessionEndAt[u];
            if (endSession < endCap) endCap = endSession;
        }

        // Tidak ada accrual jika tidak aktif
        if (!miningActive[u] || endCap <= cur) {
            return (0, toTs);
        }

        while (cur < endCap) {
            uint256 e  = _epochAtTs(cur);
            uint256 endOfEpochTs = startTime + (e + 1) * epochLength;
            uint256 segEnd = endCap < endOfEpochTs ? endCap : endOfEpochTs;
            uint256 dt = segEnd - cur;
            if (dt > 0) {
                uint256 perSec = _perSecAtEpoch(u, e);
                uint256 segAmt = perSec * dt;          // token (18d)
                if (segAmt > 0) {
                    distributedAt[e] += segAmt;        // atribusi ke epoch segmen tsb
                    paid += segAmt;
                }
            }
            cur = segEnd;
        }

        return (paid, endCap);
    }

    // =======================
    // Session & Toggle helpers
    // =======================
    function _currentEpoch() internal view returns (uint256) {
        if (block.timestamp < startTime) return 0;
        return (block.timestamp - startTime) / epochLength;
    }

    function _enforceSession(address u) internal {
        if (miningActive[u] && block.timestamp >= sessionEndAt[u]) {
            // settle sampai akhir sesi
            (uint256 paid, uint256 lastTs) = _settleAccrual(u, lastAccrueTs[u], block.timestamp);
            if (paid > 0) {
                vault.payout(u, paid);
                emit Claimed(_epochAtTs(lastTs), u, paid);
            }

            // stop
            miningActive[u] = false;
            lastAccrueTs[u] = block.timestamp;
            lastToggleEpoch[u] = _currentEpoch();
            emit MiningStopped(u, lastToggleEpoch[u]);
        }
    }

    // =======================
    // Start/Stop/Claim (WithSig; user bayar gas)
    // =======================
    function startMiningWithSig(
        address user,
        uint256 nonce,
        uint256 deadline,
        bytes calldata relayerSig
    ) external nonReentrant {
        require(msg.sender == user, "ONLY_SELF");
        _checkRelayerAuth(user, Action.Start, nonce, deadline, relayerSig);

        require(!isPrelaunch(), "PRELAUNCH");
        _enforceSession(user);

        uint256 e = epochNow();
        require(e >= lastToggleEpoch[user] + toggleCooldown, "COOLDOWN");
        require(!miningActive[user], "ALREADY_ACTIVE");

        miningActive[user] = true;
        sessionEndAt[user] = block.timestamp + sessionDuration;
        lastAccrueTs[user] = block.timestamp; // mulai accrual dari sekarang
        lastToggleEpoch[user] = e;

        nonces[user]++; // konsumsi nonce
        emit MiningStarted(user, e);
    }

    function stopMiningWithSig(
        address user,
        uint256 nonce,
        uint256 deadline,
        bytes calldata relayerSig
    ) external nonReentrant {
        require(msg.sender == user, "ONLY_SELF");
        _checkRelayerAuth(user, Action.Stop, nonce, deadline, relayerSig);

        require(!isPrelaunch(), "PRELAUNCH");
        require(miningActive[user], "NOT_ACTIVE");

        _enforceSession(user); // mungkin sudah auto-stop di dalam bila sesi lewat

        if (miningActive[user]) {
            // settle sampai sekarang (cap ke session end)
            (uint256 paid, uint256 lastTs) = _settleAccrual(user, lastAccrueTs[user], block.timestamp);
            if (paid > 0) {
                vault.payout(user, paid);
                emit Claimed(_epochAtTs(lastTs), user, paid);
            }

            miningActive[user] = false;
            lastAccrueTs[user] = block.timestamp;
            lastToggleEpoch[user] = epochNow();
            emit MiningStopped(user, lastToggleEpoch[user]);
        }

        nonces[user]++;
    }

    function claimWithSig(
        address user,
        uint256 nonce,
        uint256 deadline,
        bytes calldata relayerSig
    ) external nonReentrant {
        require(msg.sender == user, "ONLY_SELF");
        _checkRelayerAuth(user, Action.Claim, nonce, deadline, relayerSig);

        _enforceSession(user); // kalau sesi lewat, disettle & stop

        // settle (cap ke session end bila aktif)
        (uint256 paid, uint256 lastTs) = _settleAccrual(user, lastAccrueTs[user], block.timestamp);
        if (paid > 0) {
            vault.payout(user, paid);
            emit Claimed(_epochAtTs(lastTs), user, paid);
        }
        lastAccrueTs[user] = block.timestamp;

        nonces[user]++;
    }

    // =======================
    // Hook dari RigNFT: panggil sebelum balance berubah
    // =======================
    function onRigBalanceWillChange(address user) external nonReentrant {
        require(msg.sender == address(rig), "ONLY_RIG");
        _enforceSession(user);

        if (miningActive[user]) {
            // settle sampai sekarang (cap ke session end)
            (uint256 paid, uint256 lastTs) = _settleAccrual(user, lastAccrueTs[user], block.timestamp);
            if (paid > 0) {
                vault.payout(user, paid);
                emit Claimed(_epochAtTs(lastTs), user, paid);
            }

            // stop karena NFT berubah
            miningActive[user] = false;
            lastAccrueTs[user] = block.timestamp;
            lastToggleEpoch[user] = epochNow();
            emit MiningStopped(user, lastToggleEpoch[user]);
        } else {
            // tidak aktif → cukup sinkronkan timestamp supaya pending view rapi
            lastAccrueTs[user] = block.timestamp;
        }
    }

    // =======================
    // Leftover harian (ADMIN): lakukan setelah hari berakhir
    // =======================
    function distributeLeftover(uint256 dayEpoch) external onlyRole(PARAM_ADMIN) nonReentrant {
        require(!leftoverClosed[dayEpoch], "ALREADY_DONE");
        // total emisi budget hari itu (mengikuti halving)
        uint256 daily = rewardPerEpoch(dayEpoch);
        // total yang "terakru" dan telah DIATRIBUSI ke hari tsb lewat settle (retroaktif di claim/stop/hook)
        uint256 paid  = distributedAt[dayEpoch];
        uint256 leftover = daily > paid ? (daily - paid) : 0;

        leftoverClosed[dayEpoch] = true;

        if (leftover == 0) {
            emit LeftoverDistributed(dayEpoch, 0, 0, 0, 0, 0);
            return;
        }

        require(stakingVault != address(0) && spinVault != address(0) && boardVault != address(0), "VAULT_NOT_SET");

        uint256 burnAmt  = (leftover * leftoverBurnBps)  / 10_000;
        uint256 stakeAmt = (leftover * leftoverStakeBps) / 10_000;
        uint256 spinAmt  = (leftover * leftoverSpinBps)  / 10_000;
        uint256 boardAmt = leftover - burnAmt - stakeAmt - spinAmt;

        if (burnAmt  > 0) vault.burn(burnAmt);
        if (stakeAmt > 0) vault.payout(stakingVault,  stakeAmt);
        if (spinAmt  > 0) vault.payout(spinVault,     spinAmt);
        if (boardAmt > 0) vault.payout(boardVault,    boardAmt);

        emit LeftoverDistributed(dayEpoch, leftover, burnAmt, stakeAmt, spinAmt, boardAmt);
    }

    // =======================
    // Merge + Fee (via RELAYER)
    // =======================
    function mergeBasicToPro(address user, uint256 fid) external onlyRole(RELAYER_ROLE) nonReentrant {
        _chargeMergeFee(user, feeBasicToPro);
        rig.burnFrom(user, BASIC, BASIC_TO_PRO_NEED);
        rig.mintByGame(user, PRO, 1);
        emit Merged(user, fid, BASIC, PRO, BASIC_TO_PRO_NEED);
    }

    function mergeProToLegend(address user, uint256 fid) external onlyRole(RELAYER_ROLE) nonReentrant {
        _chargeMergeFee(user, feeProToLegend);
        rig.burnFrom(user, PRO, PRO_TO_LEGEND_NEED);
        rig.mintByGame(user, LEGEND, 1);
        emit Merged(user, fid, PRO, LEGEND, PRO_TO_LEGEND_NEED);
    }

    function _chargeMergeFee(address user, uint256 amount) internal {
        if (amount == 0) return;
        require(address(mergeFeeToken) != address(0), "FEE_TOKEN_NOT_SET");
        require(mergeFeeTreasury != address(0), "FEE_TREASURY_NOT_SET");
        bool ok = mergeFeeToken.transferFrom(user, mergeFeeTreasury, amount);
        require(ok, "FEE_TRANSFER_FAILED");
    }

    // =======================
    // View: pending rewards (untuk UI)
    // =======================
    function pending(address u) external view returns (uint256) {
        uint256 fromTs = lastAccrueTs[u];
        if (!miningActive[u]) return 0;

        uint256 toTs = block.timestamp;
        uint256 endSession = sessionEndAt[u];
        if (endSession < toTs) toTs = endSession;
        if (toTs <= fromTs) return 0;

        uint256 cur = fromTs;
        uint256 total;
        while (cur < toTs) {
            uint256 e  = _epochAtTs(cur);
            uint256 endOfEpochTs = startTime + (e + 1) * epochLength;
            uint256 segEnd = toTs < endOfEpochTs ? toTs : endOfEpochTs;
            uint256 dt = segEnd - cur;
            if (dt > 0) {
                uint256 perSec = _perSecAtEpoch(u, e);
                total += perSec * dt;
            }
            cur = segEnd;
        }
        return total;
    }

    // =======================
    // Admin setters
    // =======================
    function setBaseReward(uint256 b, uint256 p, uint256 l) external onlyRole(PARAM_ADMIN) {
        baseRw = BaseParams(b, p, l);
    }

    /// @notice Set limit NFT yang dihitung per tier (0 = tidak ada yang dihitung).
    function setRigCaps(uint256 capBasic, uint256 capPro, uint256 capLegend) external onlyRole(PARAM_ADMIN) {
        rigCaps = RigCaps(capBasic, capPro, capLegend);
        emit RigCapsSet(capBasic, capPro, capLegend);
    }

    function setDistributionVaults(address _staking, address _spin, address _board) external onlyRole(PARAM_ADMIN) {
        require(_staking != address(0) && _spin != address(0) && _board != address(0), "ZERO_ADDR");
        stakingVault = _staking;
        spinVault    = _spin;
        boardVault   = _board;
    }

    function setInitialReward(uint256 x) external onlyRole(PARAM_ADMIN) { initialRewardPerEpoch = x; }
    function setEpochLength(uint256 x) external onlyRole(PARAM_ADMIN)   { require(x > 0, "BAD_LEN"); epochLength = x; }
    function setStartTime(uint256 x) external onlyRole(PARAM_ADMIN)     { startTime = x; }
    function setHalvingEvery(uint256 x) external onlyRole(PARAM_ADMIN)  { halvingEvery = x; }

    function setSessionDuration(uint256 sec) external onlyRole(PARAM_ADMIN) { sessionDuration = sec; }
    function setToggleCooldown(uint256 value) external onlyRole(PARAM_ADMIN) {
        toggleCooldown = value;
        emit ToggleCooldownSet(value);
    }

    function setGoLive(bool value) external onlyRole(PARAM_ADMIN) {
        goLive = value;
        emit GoLiveSet(value);
    }

    // ---- Merge fee admin setters ----
    function setMergeFeeToken(address token) external onlyRole(PARAM_ADMIN) {
        mergeFeeToken = IERC20(token);
        emit MergeFeeTokenSet(token);
    }

    function setMergeFeeTreasury(address treasury) external onlyRole(PARAM_ADMIN) {
        require(treasury != address(0), "ZERO_ADDR");
        mergeFeeTreasury = treasury;
        emit MergeFeeTreasurySet(treasury);
    }

    /// @notice Set fee (dalam satuan token ERC20) untuk masing-masing jalur merge.
    function setMergeFees(uint256 _feeBasicToPro, uint256 _feeProToLegend) external onlyRole(PARAM_ADMIN) {
        feeBasicToPro  = _feeBasicToPro;
        feeProToLegend = _feeProToLegend;
        emit MergeFeeSet(_feeBasicToPro, _feeProToLegend);
    }

    // =======================
    // EIP-712 verify
    // =======================
    function _checkRelayerAuth(
        address user,
        Action action,
        uint256 nonce,
        uint256 deadline,
        bytes calldata sig
    ) internal view {
        require(block.timestamp <= deadline, "SIG_EXPIRED");
        require(nonce == nonces[user], "BAD_NONCE");

        bytes32 structHash = keccak256(abi.encode(
            ACTION_TYPEHASH,
            user,
            uint8(action),
            nonce,
            deadline
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _DOMAIN_SEPARATOR, structHash));
        address signer = ECDSA.recover(digest, sig);
        require(hasRole(RELAYER_ROLE, signer), "BAD_RELAYER_SIG");
    }
}

