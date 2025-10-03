// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * SpinVault (BaseTC) — Fair Daily Check-In (Relayer-Gated, User Pays Gas)
 */

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

interface IRigNFTLite {
    function balanceOf(address account, uint256 id) external view returns (uint256);
    function BASIC() external view returns (uint256);
    function PRO() external view returns (uint256);
    function LEGEND() external view returns (uint256);
}

contract SpinVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    // --- Roles ---
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    // --- External ---
    IERC20 public immutable token; // BaseTC
    IRigNFTLite public immutable rig;

    // --- Epoch config ---
    uint256 public startTime;     
    uint256 public epochLength;   

    // --- Accounting (skim) ---
    uint256 public accountedBalance; 

    // --- Daily budget (anti-tekor) ---
    uint16  public budgetBps = 500;     
    uint256 public maxDaily  = type(uint256).max; 
    uint256 public epochRemaining;      
    uint256 public lastBudgetEpoch;     

    // --- Tier ranges (18 desimal) ---
    struct Range { uint128 minAmt; uint128 maxAmt; }
    Range public basicRange   = Range(uint128(0.001 ether), uint128(0.01 ether));
    Range public proRange     = Range(uint128(0.01  ether), uint128(0.1  ether));
    Range public legendRange  = Range(uint128(0.1   ether), uint128(1    ether));
    Range public supremeRange = Range(uint128(1     ether), uint128(5    ether));

    // --- Claim guard ---
    mapping(uint256 => mapping(address => bool)) public claimed; 

    // --- EIP-712 ---
    bytes32 private immutable _DOMAIN_SEPARATOR;
    string  public constant EIP712_NAME    = "SpinVault";
    string  public constant EIP712_VERSION = "1";
    bytes32 public constant ACTION_TYPEHASH = keccak256("UserAction(address user,uint256 nonce,uint256 deadline)");
    mapping(address => uint256) public nonces;

    // --- Events ---
    event EpochConfigSet(uint256 startTime, uint256 epochLength);
    event BudgetConfigSet(uint16 budgetBps, uint256 maxDaily);
    event RangesSet(Range basic, Range pro, Range legend, Range supreme);
    event Skimmed(uint256 amount);
    event BudgetRolled(uint256 indexed epoch, uint256 dailyBudget, uint256 newAccountedBalance);
    event ClaimedSpin(address indexed user, uint256 indexed epoch, uint256 amount, uint8 tier);

    constructor(
        IERC20 baseTc,
        IRigNFTLite _rig,
        address admin,
        uint256 _startTime,
        uint256 _epochLength
    ) {
        token = baseTc;
        rig = _rig;
        startTime = _startTime;
        epochLength = _epochLength;
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

    // ========= Views =========
    function epochNow() public view returns (uint256) {
        require(startTime > 0 && epochLength > 0, "CFG");
        if (block.timestamp < startTime) return 0;
        return (block.timestamp - startTime) / epochLength;
    }

    function _tierOf(address u) internal view returns (uint8) {
        uint256 b = rig.balanceOf(u, rig.BASIC());
        uint256 p = rig.balanceOf(u, rig.PRO());
        uint256 l = rig.balanceOf(u, rig.LEGEND());
        bool sup = (b >= 10 && p >= 5 && l >= 3);
        if (sup) return 4;
        if (l > 0) return 3;
        if (p > 0) return 2;
        if (b > 0) return 1;
        return 0;
    }

    // ========= Admin =========
    function setEpochConfig(uint256 _startTime, uint256 _epochLength) external onlyRole(MANAGER_ROLE) {
        require(_epochLength > 0, "LEN");
        startTime = _startTime;
        epochLength = _epochLength;
        emit EpochConfigSet(_startTime, _epochLength);
    }

    function setBudget(uint16 _budgetBps, uint256 _maxDaily) external onlyRole(MANAGER_ROLE) {
        require(_budgetBps <= 10_000, "BPS");
        budgetBps = _budgetBps;
        maxDaily = _maxDaily;
        emit BudgetConfigSet(_budgetBps, _maxDaily);
    }

    function setRanges(Range calldata b, Range calldata p, Range calldata l, Range calldata s) external onlyRole(MANAGER_ROLE) {
        require(b.minAmt <= b.maxAmt && p.minAmt <= p.maxAmt && l.minAmt <= l.maxAmt && s.minAmt <= s.maxAmt, "RANGE");
        basicRange = b; proRange = p; legendRange = l; supremeRange = s;
        emit RangesSet(b, p, l, s);
    }

    function grantRelayer(address r) external onlyRole(DEFAULT_ADMIN_ROLE) { _grantRole(RELAYER_ROLE, r); }
    function revokeRelayer(address r) external onlyRole(DEFAULT_ADMIN_ROLE) { _revokeRole(RELAYER_ROLE, r); }

    function rescue(address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(amount <= accountedBalance, "EXCEEDS");
        accountedBalance -= amount;
        token.safeTransfer(to, amount);
    }

    // ========= Internal helpers =========
    function _skim() internal returns (uint256 newly) {
        uint256 bal = token.balanceOf(address(this));
        if (bal > accountedBalance) {
            newly = bal - accountedBalance;
            accountedBalance = bal;
            emit Skimmed(newly);
        }
    }

    function _rollEpoch() internal {
        uint256 e = epochNow();
        if (e == lastBudgetEpoch) return; 
        _skim();
        uint256 bal = accountedBalance;
        uint256 daily = (bal * budgetBps) / 10_000;
        if (daily > maxDaily) daily = maxDaily;
        epochRemaining = daily;
        lastBudgetEpoch = e;
        emit BudgetRolled(e, daily, bal);
    }

    function _rand(address u, uint256 e, Range memory r) internal view returns (uint256) {
        if (r.minAmt == r.maxAmt) return r.minAmt;
        uint256 span = uint256(r.maxAmt - r.minAmt);
        uint256 h = uint256(keccak256(abi.encodePacked(u, e, block.prevrandao, address(this))));
        return r.minAmt + (h % (span + 1));
    }

    function _claimInternal(address user) internal returns (uint256 amt, uint256 e, uint8 t) {
        _rollEpoch(); 
        require(epochRemaining > 0, "NO_BUDGET");
        e = lastBudgetEpoch;
        require(!claimed[e][user], "CLAIMED");

        t = _tierOf(user);
        require(t > 0, "NO_RIG");

        if (t == 4) amt = _rand(user, e, supremeRange);
        else if (t == 3) amt = _rand(user, e, legendRange);
        else if (t == 2) amt = _rand(user, e, proRange);
        else amt = _rand(user, e, basicRange);

        if (amt > epochRemaining) amt = epochRemaining; 
        require(amt > 0 && amt <= accountedBalance, "INSUFFICIENT");

        accountedBalance -= amt;
        epochRemaining -= amt;
        claimed[e][user] = true;
    }

    // ========= EIP-712 Relayer-gated claim =========
    function claimWithSig(
        address user,
        uint256 nonce,
        uint256 deadline,
        bytes calldata relayerSig
    ) external nonReentrant {
        require(msg.sender == user, "ONLY_SELF");
        require(block.timestamp <= deadline, "SIG_EXPIRED");
        require(nonce == nonces[user], "BAD_NONCE");

        bytes32 structHash = keccak256(abi.encode(
            ACTION_TYPEHASH,
            user,
            nonce,
            deadline
        ));
        // ✅ fix di sini: pakai hex escape
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _DOMAIN_SEPARATOR, structHash));
        address signer = ECDSA.recover(digest, relayerSig);
        require(hasRole(RELAYER_ROLE, signer), "BAD_RELAYER_SIG");

        (uint256 amt, uint256 e, uint8 tier) = _claimInternal(user);
        nonces[user]++;

        token.safeTransfer(user, amt);
        emit ClaimedSpin(user, e, amt, tier);
    }
}

