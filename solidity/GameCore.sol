// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/// @dev Minimal interface dari RigNFT versi kamu (dengan role mint/burn khusus)
interface IRigNFT {
    function BASIC() external view returns (uint256);
    function PRO() external view returns (uint256);
    function LEGEND() external view returns (uint256);

    function balanceOf(address account, uint256 id) external view returns (uint256);

    // GameCore akan menggunakan ini:
    function burnFrom(address account, uint256 id, uint256 amount) external;
    function mintByGame(address to, uint256 id, uint256 amount) external;
}

/// @dev Vault untuk bayar hadiah & burn sisa pool
interface IRewardsVault {
    function payout(address to, uint256 amount) external;
    function burn(uint256 amount) external;
}

/// @title BaseTC GameCore
/// @notice Merge (10→1, 5→1), Supreme status, epoch harian + halving, hybrid reward + cap, klaim via RewardsVault.
/// @dev Semua aksi user dipanggil lewat RELAYER_ROLE untuk cegah penyalahgunaan dari luar mini-app.
contract GameCore is AccessControl, ReentrancyGuard {
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
    // Merge constants
    // =======================
    uint256 public constant BASIC_TO_PRO_NEED  = 10;
    uint256 public constant PRO_TO_LEGEND_NEED = 5;

    // =======================
    // Epoch & Halving
    // =======================
    uint256 public startTime;             // epoch start (unix)
    uint256 public epochLength;           // seconds; default 86400
    uint256 public initialRewardPerEpoch; // wei; total pool per epoch sebelum halving
    uint256 public halvingEvery;          // jumlah epoch per halving; default 30

    // =======================
    // Hashrate & Hybrid reward
    // =======================
    struct HashrateParams { uint256 b; uint256 p; uint256 l; }   // bobot hashrate per tier
    struct BaseParams     { uint256 b; uint256 p; uint256 l; }   // base reward per NFT/epoch

    // default: 1/5/25 dan 0.2 / 1 / 5 token per epoch (dalam wei token)
    HashrateParams public hashrate = HashrateParams(1, 5, 25);
    BaseParams     public baseRw   = BaseParams(0.2 ether, 1 ether, 5 ether);

    /// @notice Plafon payout per user per-epoch = capMul * userHash
    uint256 public capMul = 100 ether;

    // =======================
    // Storage snapshot per epoch
    // =======================
    // agregat epoch
    mapping(uint256 => uint256) public totalHashAt;
    mapping(uint256 => uint256) public basePoolAt;
    mapping(uint256 => bool)    public finalized;

    // per-user per-epoch
    mapping(uint256 => mapping(address => uint256)) public userHashAt;
    mapping(uint256 => mapping(address => uint256)) public userBaseAt;
    mapping(uint256 => mapping(address => bool))    public claimed;

    // =======================
    // >>> Tambahan: Start/Stop Mining & GoLive <<<
    // =======================
    /// @notice status mining (on/off) per user
    mapping(address => bool) public miningActive;

    /// @notice epoch terakhir saat user men-toggle (untuk cooldown)
    mapping(address => uint256) public lastToggleEpoch;

    /// @notice minimal jeda epoch antar toggle start/stop
    uint256 public toggleCooldown = 1;

    /// @notice Flag prelaunch sederhana. Jika true: mining baru dianggap aktif saat epoch >= 1.
    bool public goLive;

    event MiningStarted(address indexed user, uint256 epoch);
    event MiningStopped(address indexed user, uint256 epoch);
    event ToggleCooldownSet(uint256 value);
    event GoLiveSet(bool value);

    // >>> Event tambahan untuk relayer/admin <<<
    event MiningStartedByRelayer(address indexed relayer, address indexed user, uint256 epoch);
    event MiningStoppedByRelayer(address indexed relayer, address indexed user, uint256 epoch);
    event MiningForceSet(address indexed admin, address indexed user, bool active, uint256 epoch);

    // =======================
    // Events existing
    // =======================
    event Merged(address indexed user, uint256 indexed fid, uint256 fromId, uint256 toId, uint256 need);
    event EpochFinalized(uint256 indexed e, uint256 rewardPerEpoch, uint256 totalHash, uint256 baseSum);
    event Claimed(uint256 indexed e, address indexed user, uint256 amount);

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
    }

    // =======================
    // View helpers
    // =======================
    function epochNow() public view returns (uint256) {
        require(block.timestamp >= startTime, "NOT_STARTED");
        return (block.timestamp - startTime) / epochLength;
    }

    function rewardPerEpoch(uint256 e) public view returns (uint256) {
        if (halvingEvery == 0) return initialRewardPerEpoch;
        uint256 halvings = e / halvingEvery;      // setiap N epoch, /2
        return initialRewardPerEpoch >> halvings; // / 2^halvings
    }

    function _balances(address u) internal view returns (uint256 b, uint256 p, uint256 l) {
        b = rig.balanceOf(u, BASIC);
        p = rig.balanceOf(u, PRO);
        l = rig.balanceOf(u, LEGEND);
    }

    /// @dev Perhitungan hashrate dasar dari kepemilikan NFT (tanpa memperhatikan state aktif/paused)
    function _baseHashrate(address u) internal view returns (uint256) {
        (uint256 b, uint256 p, uint256 l) = _balances(u);
        unchecked { return b * hashrate.b + p * hashrate.p + l * hashrate.l; }
    }

    /// @notice True jika goLive==true dan BELUM masuk epoch 1 (termasuk sebelum startTime).
    function isPrelaunch() public view returns (bool) {
        if (!goLive) return false;
        // sebelum startTime: anggap prelaunch
        if (block.timestamp < startTime) return true;
        // setelah startTime: prelaunch selama masih epoch 0
        uint256 e = (block.timestamp - startTime) / epochLength;
        return (e < 1);
    }

    /// @notice HASHRATE RESMI: jika user paused atau masih prelaunch → 0, jika aktif → hitung dari NFT
    function getHashrate(address u) public view returns (uint256) {
        if (isPrelaunch()) return 0;
        if (!miningActive[u]) return 0;
        return _baseHashrate(u);
    }

    function getBaseUnit(address u) public view returns (uint256) {
        (uint256 b, uint256 p, uint256 l) = _balances(u);
        unchecked { return b * baseRw.b + p * baseRw.p + l * baseRw.l; }
    }

    function isSupreme(address u) external view returns (bool) {
        (uint256 b, uint256 p, uint256 l) = _balances(u);
        return (b >= 10 && p >= 5 && l >= 3);
    }

    // =======================
    // >>> Start/Stop APIs (user) <<<
    // =======================
    function setToggleCooldown(uint256 value) external onlyRole(PARAM_ADMIN) {
        toggleCooldown = value;
        emit ToggleCooldownSet(value);
    }

    function startMining() external {
        require(!isPrelaunch(), "PRELAUNCH");
        uint256 e = epochNow();
        require(e >= lastToggleEpoch[msg.sender] + toggleCooldown, "cooldown");
        require(!miningActive[msg.sender], "already active");
        miningActive[msg.sender] = true;
        lastToggleEpoch[msg.sender] = e;
        emit MiningStarted(msg.sender, e);
    }

    function stopMining() external {
        require(!isPrelaunch(), "PRELAUNCH");
        uint256 e = epochNow();
        require(e >= lastToggleEpoch[msg.sender] + toggleCooldown, "cooldown");
        require(miningActive[msg.sender], "not active");
        miningActive[msg.sender] = false;
        lastToggleEpoch[msg.sender] = e;
        emit MiningStopped(msg.sender, e);
    }

    // =======================
    // >>> Start/Stop via RELAYER (baru) <<<
    // =======================
    /// @notice Wrapper kompatibel untuk endpoint lama: setActive(user, active)
    function setActive(address user, bool active_) external onlyRole(RELAYER_ROLE) {
        require(!isPrelaunch(), "PRELAUNCH");
        uint256 e = epochNow();
        require(e >= lastToggleEpoch[user] + toggleCooldown, "cooldown");

        if (active_) {
            require(!miningActive[user], "already active");
            miningActive[user] = true;
            lastToggleEpoch[user] = e;
            emit MiningStartedByRelayer(msg.sender, user, e);
        } else {
            require(miningActive[user], "not active");
            miningActive[user] = false;
            lastToggleEpoch[user] = e;
            emit MiningStoppedByRelayer(msg.sender, user, e);
        }
    }

    /// @notice Relayer menyalakan mining untuk user (hormati cooldown)
    function startMiningFor(address user) external onlyRole(RELAYER_ROLE) {
        require(!isPrelaunch(), "PRELAUNCH");
        uint256 e = epochNow();
        require(e >= lastToggleEpoch[user] + toggleCooldown, "cooldown");
        require(!miningActive[user], "already active");
        miningActive[user] = true;
        lastToggleEpoch[user] = e;
        emit MiningStartedByRelayer(msg.sender, user, e);
    }

    /// @notice Relayer mematikan mining untuk user (hormati cooldown)
    function stopMiningFor(address user) external onlyRole(RELAYER_ROLE) {
        require(!isPrelaunch(), "PRELAUNCH");
        uint256 e = epochNow();
        require(e >= lastToggleEpoch[user] + toggleCooldown, "cooldown");
        require(miningActive[user], "not active");
        miningActive[user] = false;
        lastToggleEpoch[user] = e;
        emit MiningStoppedByRelayer(msg.sender, user, e);
    }

    /// @notice Admin paksa set status mining (tanpa cooldown) — buat recovery/ops
    function forceSetMining(address user, bool active_) external onlyRole(PARAM_ADMIN) {
        // Boleh override saat prelaunch untuk ops? Kalau mau strict, bisa uncomment baris di bawah:
        // require(!isPrelaunch(), "PRELAUNCH");
        uint256 e = epochNow();
        miningActive[user] = active_;
        lastToggleEpoch[user] = e;
        emit MiningForceSet(msg.sender, user, active_, e);
    }

    // =======================
    // Merge (RELAYER only)
    // =======================
    /// @notice 10 BASIC -> 1 PRO
    function mergeBasicToPro(address user, uint256 fid) external onlyRole(RELAYER_ROLE) nonReentrant {
        rig.burnFrom(user, BASIC, BASIC_TO_PRO_NEED);
        rig.mintByGame(user, PRO, 1); // PRO unlimited; mint via GAME path
        emit Merged(user, fid, BASIC, PRO, BASIC_TO_PRO_NEED);
    }

    /// @notice 5 PRO -> 1 LEGEND (cap 1000 via RigNFT.mintByGame)
    function mergeProToLegend(address user, uint256 fid) external onlyRole(RELAYER_ROLE) nonReentrant {
        rig.burnFrom(user, PRO, PRO_TO_LEGEND_NEED);
        rig.mintByGame(user, LEGEND, 1); // RigNFT enforce LEGEND_GAME_CAP (=1000)
        emit Merged(user, fid, PRO, LEGEND, PRO_TO_LEGEND_NEED);
    }

    // =======================
    // Snapshot (RELAYER) & Finalize (ADMIN/PARAM_ADMIN)
    // =======================
    function pushSnapshot(address user) external onlyRole(RELAYER_ROLE) {
        uint256 e = epochNow();
        require(!finalized[e], "EPOCH_LOCKED");
        userHashAt[e][user] = getHashrate(user);  // hormati start/stop + prelaunch
        userBaseAt[e][user] = getBaseUnit(user);
        // totalHash & basePool diakumulasi off-chain → di-input saat finalize demi hemat gas
    }

    function finalizeEpoch(uint256 e, uint256 totalHash, uint256 baseSum) external onlyRole(PARAM_ADMIN) {
        require(!finalized[e], "ALREADY_FINAL");
        finalized[e]   = true;
        totalHashAt[e] = totalHash;
        basePoolAt[e]  = baseSum;
        emit EpochFinalized(e, rewardPerEpoch(e), totalHash, baseSum);
    }

    // =======================
    // Preview & Claim (RELAYER)
    // =======================
    function preview(uint256 e, address u) public view returns (uint256) {
        require(finalized[e], "NOT_FINAL");
        uint256 pool   = rewardPerEpoch(e);
        uint256 base   = basePoolAt[e];
        uint256 left   = pool > base ? (pool - base) : 0;

        uint256 tHash  = totalHashAt[e];
        uint256 uHash  = userHashAt[e][u];
        uint256 uBase  = userBaseAt[e][u];

        uint256 proRata = (tHash == 0) ? 0 : (left * uHash) / tHash;
        uint256 raw     = uBase + proRata;

        uint256 cap     = capMul * uHash;
        return raw > cap ? cap : raw;
    }

    function claim(uint256 e, address u) external onlyRole(RELAYER_ROLE) nonReentrant {
        require(finalized[e], "NOT_FINAL");
        require(!claimed[e][u], "CLAIMED");

        uint256 amount = preview(e, u);
        claimed[e][u] = true;

        if (amount > 0) {
            vault.payout(u, amount);
        }
        emit Claimed(e, u, amount);
    }

    /// @notice Burn sisa pool (opsional) setelah distribusi epoch
    function burnLeftover(uint256 /*e*/, uint256 amount) external onlyRole(PARAM_ADMIN) {
        if (amount > 0) vault.burn(amount);
    }

    // =======================
    // Admin setters (tidak retroaktif)
    // =======================
    function setHashrate(uint256 b, uint256 p, uint256 l) external onlyRole(PARAM_ADMIN) {
        hashrate = HashrateParams(b, p, l);
    }

    function setBaseReward(uint256 b, uint256 p, uint256 l) external onlyRole(PARAM_ADMIN) {
        baseRw = BaseParams(b, p, l);
    }

    function setCapMul(uint256 x) external onlyRole(PARAM_ADMIN) {
        capMul = x;
    }

    function setInitialReward(uint256 x) external onlyRole(PARAM_ADMIN) {
        initialRewardPerEpoch = x;
    }

    function setEpochLength(uint256 x) external onlyRole(PARAM_ADMIN) {
        epochLength = x;
    }

    function setStartTime(uint256 x) external onlyRole(PARAM_ADMIN) {
        startTime = x;
    }

    function setHalvingEvery(uint256 x) external onlyRole(PARAM_ADMIN) {
        halvingEvery = x;
    }

    /// @notice Toggle prelaunch sederhana. Jika true: kontrak akan menganggap aktif hanya saat epoch >= 1.
    function setGoLive(bool value) external onlyRole(PARAM_ADMIN) {
        goLive = value;
        emit GoLiveSet(value);
    }
}

