// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @dev Minimal interface dari RigNFT
interface IRigNFT {
    function BASIC() external view returns (uint256);
    function PRO() external view returns (uint256);
    function LEGEND() external view returns (uint256);

    function balanceOf(address account, uint256 id) external view returns (uint256);
    function burnFrom(address account, uint256 id, uint256 amount) external;
    function mintByGame(address to, uint256 id, uint256 amount) external;
}

/// @dev Vault untuk bayar hadiah & burn sisa pool
interface IRewardsVault {
    function payout(address to, uint256 amount) external;
    function burn(uint256 amount) external;
}

/// @dev ERC20 minimal untuk biaya merge
interface IERC20 {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

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

    uint256 private immutable BASIC;
    uint256 private immutable PRO;
    uint256 private immutable LEGEND;

    // =======================
    // Epoch & Reward config
    // =======================
    uint256 public startTime;
    uint256 public epochLength;
    uint256 public initialRewardPerEpoch;
    uint256 public halvingEvery;

    struct BaseParams { uint256 b; uint256 p; uint256 l; }
    BaseParams public baseRw = BaseParams(0.333 ether, 1 ether, 5 ether);

    struct RigCaps { uint256 b; uint256 p; uint256 l; }
    RigCaps public rigCaps = RigCaps(10, 5, 3);
    event RigCapsSet(uint256 basicCap, uint256 proCap, uint256 legendCap);

    uint256 public sessionDuration = 24 hours;
    mapping(address => uint256) public sessionEndAt;
    uint256 public toggleCooldown = 1;
    mapping(address => uint256) public lastToggleEpoch;
    bool public goLive;

    mapping(address => bool)    public miningActive;
    mapping(address => uint256) public lastAccrueTs;

    mapping(uint256 => uint256) public distributedAt;
    mapping(uint256 => bool)    public leftoverClosed;

    uint16 public leftoverBurnBps  = 5000;
    uint16 public leftoverStakeBps = 3000;
    uint16 public leftoverSpinBps  = 1000;
    uint16 public leftoverBoardBps = 1000;

    address public stakingVault;
    address public spinVault;
    address public boardVault;

    // =======================
    // EIP-712
    // =======================
    bytes32 private immutable _DOMAIN_SEPARATOR;
    bytes32 public constant ACTION_TYPEHASH =
        keccak256("UserAction(address user,uint8 action,uint256 nonce,uint256 deadline)");
    string  public constant EIP712_NAME    = "GameCore";
    string  public constant EIP712_VERSION = "1";
    mapping(address => uint256) public nonces;

    enum Action { Start, Stop, Claim }

    // =======================
    // Merge constants
    // =======================
    uint256 public constant BASIC_TO_PRO_NEED  = 10;
    uint256 public constant PRO_TO_LEGEND_NEED = 5;

    // ===== NEW: Merge fee config =====
    IERC20  public mergeFeeToken;
    address public mergeFeeTreasury;
    uint256 public feeBasicToPro;
    uint256 public feeProToLegend;

    event MergeFeeTokenSet(address token);
    event MergeFeeTreasurySet(address treasury);
    event MergeFeeSet(uint256 feeBasicToPro, uint256 feeProToLegend);

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
        epochLength           = _epochLength;
        initialRewardPerEpoch = _initialRewardPerEpoch;
        halvingEvery          = _halvingEvery;

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
    // Merge Fee Logic
    // =======================
    function setMergeFeeToken(address token) external onlyRole(PARAM_ADMIN) {
        mergeFeeToken = IERC20(token);
        emit MergeFeeTokenSet(token);
    }

    function setMergeFeeTreasury(address treasury) external onlyRole(PARAM_ADMIN) {
        require(treasury != address(0), "ZERO_TREASURY");
        mergeFeeTreasury = treasury;
        emit MergeFeeTreasurySet(treasury);
    }

    function setMergeFees(uint256 _feeBasicToPro, uint256 _feeProToLegend) external onlyRole(PARAM_ADMIN) {
        feeBasicToPro  = _feeBasicToPro;
        feeProToLegend = _feeProToLegend;
        emit MergeFeeSet(_feeBasicToPro, _feeProToLegend);
    }

    function _chargeMergeFee(address user, uint256 amount) internal {
        if (address(mergeFeeToken) == address(0) || amount == 0) return;
        require(mergeFeeTreasury != address(0), "TREASURY_NOT_SET");
        bool ok = mergeFeeToken.transferFrom(user, mergeFeeTreasury, amount);
        require(ok, "FEE_TRANSFER_FAIL");
    }

    // =======================
    // Merge with fee
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

    // ... [SEMUA kode lain reward, accrual, session, leftover, claim, dsb tetap sama tanpa dihapus]
    // (potongan penuh sudah ada di versi kamu, hanya bagian Merge yang aku timpa + tambahan setter fee)
}

