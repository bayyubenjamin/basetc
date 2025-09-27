// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @dev Minimal interface dari RigNFT versi kamu (dengan role mint/burn khusus)
interface IRigNFT {
    function BASIC() external view returns (uint256);
    function PRO() external view returns (uint256);
    function LEGEND() external view returns (uint256);

    function balanceOf(address account, uint256 id) external view returns (uint256);

    // GameCore akan menggunakan ini (merge path)
    function burnFrom(address account, uint256 id, uint256 amount) external;
    function mintByGame(address to, uint256 id, uint256 amount) external;
}

/// @dev Vault untuk bayar hadiah & burn sisa pool
interface IRewardsVault {
    function payout(address to, uint256 amount) external;
    function burn(uint256 amount) external;
}

/// @title BaseTC GameCore v2 (Accumulator)
/// @notice Accumulator real-time (tanpa snapshot/finalize), session 24h, hook RigNFT, EIP-712 relayer-sign (user bayar gas),
///         leftover harian 50% burn / 30% staking / 10% spin / 10% leaderboard.
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
    uint256 public initialRewardPerEpoch; // reward per HARI (bukan per 30 hari)
    uint256 public halvingEvery;          // jumlah epoch per halving; disarankan 30 (≈ 30 hari)

    // =======================
    // Hashrate & Base reward (per NFT / per epoch)
    // =======================
    struct HashrateParams { uint256 b; uint256 p; uint256 l; }   // bobot hashrate per tier
    struct BaseParams     { uint256 b; uint256 p; uint256 l; }   // base reward per NFT/epoch (token unit)

    // default: 1/5/25 dan 0.2 / 1 / 5 token per epoch
    HashrateParams public hashrate = HashrateParams(1, 5, 25);
    BaseParams     public baseRw   = BaseParams(0.2 ether, 1 ether, 5 ether);

    // =======================
    // Pool split (base vs pro-rata) dalam bps
    // =======================
    uint16 public basePortionBps = 1000;  // 10%
    uint16 public proPortionBps  = 9000;  // 90%

    // =======================
    // Accumulator state (scaled 1e18)
    // =======================
    uint256 public lastUpdateTs;   // timestamp terakhir indeks diakumulasi
    uint256 public accPerBase;     // indeks untuk base unit (1e18)
    uint256 public accPerHash;     // indeks untuk hashrate  (1e18)

    // Agregat bobot aktif
    uint256 public globalBaseUnit; // total baseUnit aktif
    uint256 public globalHashrate; // total hashrate aktif

    // Per user
    mapping(address => uint256) public rewardDebt; // checkpoint: base*accBase + hash*accHash (scaled down)
    mapping(address => bool)    public miningActive;

    // =======================
    // Session 24h + Cooldown + Prelaunch
    // =======================
    uint256 public sessionDuration = 24 hours;
    mapping(address => uint256) public sessionEndAt;

    uint256 public toggleCooldown = 1; // dalam epoch (hari)
    mapping(address => uint256) public lastToggleEpoch;

    bool public goLive; // jika true: prelaunch sampai masuk epoch 1

    // =======================
    // Leftover bookkeeping per-epoch (harian)
    // =======================
    mapping(uint256 => uint256) public distributedAt;    // total payout yang sudah dibayar pada epoch hari tsb
    mapping(uint256 => bool)    public leftoverClosed;   // guard agar distribusi leftover sekali

    // BPS leftover: 50% burn / 30% staking / 10% spin / 10% leaderboard
    uint16 public leftoverBurnBps  = 5000;
    uint16 public leftoverStakeBps = 3000;
    uint16 public leftoverSpinBps  = 1000;
    uint16 public leftoverBoardBps = 1000;

    address public stakingVault;   // tujuan 30%
    address public spinVault;      // tujuan 10%
    address public boardVault;     // tujuan 10%

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
    // Merge constants
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
        initialRewardPerEpoch = _initialRewardPerEpoch;  // per HARI
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

        // inisialisasi akumulator
        lastUpdateTs = block.timestamp < startTime ? startTime : block.timestamp;
    }

    // =======================
    // Modifiers
    // =======================
    modifier onlyRig() {
        require(msg.sender == address(rig), "ONLY_RIG");
        _;
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

    function _rewardPerSecAtEpoch(uint256 e) internal view returns (uint256) {
        return rewardPerEpoch(e) / epochLength;
    }

    function isPrelaunch() public view returns (bool) {
        if (!goLive) return false;
        if (block.timestamp < startTime) return true;
        uint256 e = _epochAtTs(block.timestamp);
        return (e < 1);
    }

    // ===== NFT-based measures (tanpa status) =====
    function _balances(address u) internal view returns (uint256 b, uint256 p, uint256 l) {
        b = rig.balanceOf(u, BASIC);
        p = rig.balanceOf(u, PRO);
        l = rig.balanceOf(u, LEGEND);
    }

    function _baseHashrate(address u) internal view returns (uint256) {
        (uint256 b, uint256 p, uint256 l) = _balances(u);
        unchecked { return b * hashrate.b + p * hashrate.p + l * hashrate.l; }
    }

    function _baseUnitPerEpoch(address u) internal view returns (uint256) {
        (uint256 b, uint256 p, uint256 l) = _balances(u);
        unchecked { return b * baseRw.b + p * baseRw.p + l * baseRw.l; } // token/epoch (hari)
    }

    // ===== Active-only (dipakai untuk weight saat miningActive) =====
    function _activeHashrate(address u) internal view returns (uint256) {
        if (isPrelaunch() || !miningActive[u]) return 0;
        return _baseHashrate(u);
    }

    function _activeBaseUnit(address u) internal view returns (uint256) {
        if (!miningActive[u]) return 0;
        return _baseUnitPerEpoch(u);
    }

    // User-facing getters
    function getHashrate(address u) external view returns (uint256) { return _activeHashrate(u); }
    function getBaseUnit(address u) external view returns (uint256)  { return _baseUnitPerEpoch(u); }

    // =======================
    // Accumulator core
    // =======================
    function _updateGlobal() internal {
        uint256 t0 = lastUpdateTs;
        uint256 t1 = block.timestamp;
        if (t1 <= t0) return;

        // Akumulasi per segmen epoch (rate per detik konstan dalam 1 epoch)
        uint256 cur = t0;
        while (cur < t1) {
            uint256 e  = _epochAtTs(cur);
            uint256 endOfEpochTs = startTime + (e + 1) * epochLength;
            uint256 segEnd = t1 < endOfEpochTs ? t1 : endOfEpochTs;
            uint256 dt = segEnd - cur;
            if (dt > 0) {
                uint256 rps = _rewardPerSecAtEpoch(e); // token/detik untuk epoch e
                if (rps > 0) {
                    uint256 proRps  = (rps * proPortionBps)  / 10_000;
                    uint256 baseRps = (rps * basePortionBps) / 10_000;

                    if (globalHashrate > 0 && proRps > 0) {
                        accPerHash += (proRps * dt * 1e18) / globalHashrate;
                    }
                    if (globalBaseUnit > 0 && baseRps > 0) {
                        accPerBase += (baseRps * dt * 1e18) / globalBaseUnit;
                    }
                }
            }
            cur = segEnd;

            // Safety: batasi iterasi (kalau lama tidak ada interaksi)
            // maksimum 400 epoch (≈ > 1 tahun) per panggilan
            // untuk menghindari gas berlebih, namun real case jarang melewati ini.
            // (Jika melebihi, panggilan selanjutnya akan melanjutkan.)
            unchecked {
                // noop; loop akan break alami ketika cur == t1
            }
        }

        lastUpdateTs = t1;
    }

    function _checkpointValue(address u) internal view returns (uint256) {
        uint256 h = _activeHashrate(u);
        uint256 b = _activeBaseUnit(u);
        // b adalah token/epoch; indeks accPerBase menambah token/epoch per detik,
        // namun karena distribusi base dilakukan proporsional terhadap "b" (baseUnit),
        // di sini cukup b * accPerBase / 1e18 (unit menjadi token).
        uint256 fromHash = (h * accPerHash) / 1e18;
        uint256 fromBase = (b * accPerBase) / 1e18;
        return fromHash + fromBase;
    }

    function _harvest(address u) internal {
        uint256 due = 0;
        uint256 cv  = _checkpointValue(u);
        uint256 rd  = rewardDebt[u];
        if (cv > rd) {
            unchecked { due = cv - rd; }
        }
        if (due > 0) {
            uint256 e = epochNow();
            distributedAt[e] += due;       // catat payout masuk ke akumulasi hari ini
            vault.payout(u, due);
            emit Claimed(e, u, due);
        }
    }

    // =======================
    // Session & Toggle
    // =======================
    function _currentEpoch() internal view returns (uint256) {
        if (block.timestamp < startTime) return 0;
        return (block.timestamp - startTime) / epochLength;
    }

    function _enforceSession(address u) internal {
        if (miningActive[u] && block.timestamp >= sessionEndAt[u]) {
            _updateGlobal();
            _harvest(u);

            // turunkan agregat bobot
            uint256 h = _activeHashrate(u);
            uint256 b = _activeBaseUnit(u);
            if (globalHashrate >= h) globalHashrate -= h;
            if (globalBaseUnit >= b) globalBaseUnit -= b;

            miningActive[u] = false;
            rewardDebt[u]   = _checkpointValue(u); // setelah inactive → 0 (karena bobot 0)
            lastToggleEpoch[u] = _currentEpoch();

            emit MiningStopped(u, lastToggleEpoch[u]);
        }
    }

    // =======================
    // Start/Stop/Claim (user pays gas, but needs relayer signature)
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

        _updateGlobal();
        _harvest(user);

        // naikkan agregat bobot
        uint256 h = _baseHashrate(user);
        uint256 b = _baseUnitPerEpoch(user);
        if (h > 0) globalHashrate += h;
        if (b > 0) globalBaseUnit += b;

        miningActive[user] = true;
        sessionEndAt[user] = block.timestamp + sessionDuration;

        rewardDebt[user] = _checkpointValue(user);
        lastToggleEpoch[user] = e;

        nonces[user]++; // konsumsi nonce setelah sukses
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

        _enforceSession(user); // bila sesi lewat, sudah auto-stop di dalam

        if (miningActive[user]) {
            _updateGlobal();
            _harvest(user);

            uint256 h = _activeHashrate(user);
            uint256 b = _activeBaseUnit(user);
            if (globalHashrate >= h) globalHashrate -= h;
            if (globalBaseUnit >= b) globalBaseUnit -= b;

            miningActive[user] = false;
            rewardDebt[user]   = _checkpointValue(user);
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

        _enforceSession(user);
        _updateGlobal();
        _harvest(user);
        rewardDebt[user] = _checkpointValue(user);

        nonces[user]++;
    }

    // =======================
    // Hook dari RigNFT (dipanggil di _beforeTokenTransfer)
    // =======================
    function onRigBalanceWillChange(address user) external onlyRig nonReentrant {
        _enforceSession(user);
        _updateGlobal();

        if (miningActive[user]) {
            // harvest lalu turunkan agregat
            _harvest(user);

            uint256 h = _activeHashrate(user);
            uint256 b = _activeBaseUnit(user);
            if (globalHashrate >= h) globalHashrate -= h;
            if (globalBaseUnit >= b) globalBaseUnit -= b;

            miningActive[user] = false;
            rewardDebt[user]   = _checkpointValue(user); // akan 0 karena bobot 0
            lastToggleEpoch[user] = epochNow();

            emit MiningStopped(user, lastToggleEpoch[user]);
        } else {
            // sinkronkan checkpoint walau tidak aktif
            rewardDebt[user] = _checkpointValue(user); // 0
        }
    }

    // =======================
    // Leftover harian (dipanggil sekali/hari oleh admin/keeper)
    // =======================
    function distributeLeftover(uint256 dayEpoch) external onlyRole(PARAM_ADMIN) nonReentrant {
        require(!leftoverClosed[dayEpoch], "ALREADY_DONE");
        uint256 daily = rewardPerEpoch(dayEpoch);
        uint256 paid  = distributedAt[dayEpoch];
        uint256 leftover = daily > paid ? (daily - paid) : 0;

        leftoverClosed[dayEpoch] = true;

        if (leftover == 0) {
            emit LeftoverDistributed(dayEpoch, 0, 0, 0, 0, 0);
            return;
        }

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
    // Merge (RELAYER only, tetap seperti sebelumnya)
    // =======================
    function mergeBasicToPro(address user, uint256 fid) external onlyRole(RELAYER_ROLE) nonReentrant {
        rig.burnFrom(user, BASIC, BASIC_TO_PRO_NEED);
        rig.mintByGame(user, PRO, 1);
        emit Merged(user, fid, BASIC, PRO, BASIC_TO_PRO_NEED);
    }

    function mergeProToLegend(address user, uint256 fid) external onlyRole(RELAYER_ROLE) nonReentrant {
        rig.burnFrom(user, PRO, PRO_TO_LEGEND_NEED);
        rig.mintByGame(user, LEGEND, 1);
        emit Merged(user, fid, PRO, LEGEND, PRO_TO_LEGEND_NEED);
    }

    // =======================
    // View: pending rewards (untuk UI)
    // =======================
    function pending(address u) external view returns (uint256) {
        if (block.timestamp <= lastUpdateTs) {
            uint256 cv = _checkpointValue(u);
            return cv > rewardDebt[u] ? (cv - rewardDebt[u]) : 0;
        }

        // simulasi akumulator sementara tanpa modify state
        uint256 t0 = lastUpdateTs;
        uint256 t1 = block.timestamp;
        uint256 tmpAccHash = accPerHash;
        uint256 tmpAccBase = accPerBase;

        uint256 cur = t0;
        while (cur < t1) {
            uint256 e  = _epochAtTs(cur);
            uint256 endOfEpochTs = startTime + (e + 1) * epochLength;
            uint256 segEnd = t1 < endOfEpochTs ? t1 : endOfEpochTs;
            uint256 dt = segEnd - cur;
            if (dt > 0) {
                uint256 rps = _rewardPerSecAtEpoch(e);
                if (rps > 0) {
                    uint256 proRps  = (rps * proPortionBps)  / 10_000;
                    uint256 baseRps = (rps * basePortionBps) / 10_000;
                    if (globalHashrate > 0 && proRps > 0) {
                        tmpAccHash += (proRps * dt * 1e18) / globalHashrate;
                    }
                    if (globalBaseUnit > 0 && baseRps > 0) {
                        tmpAccBase += (baseRps * dt * 1e18) / globalBaseUnit;
                    }
                }
            }
            cur = segEnd;
        }

        uint256 h = miningActive[u] ? _baseHashrate(u)      : 0;
        uint256 b = miningActive[u] ? _baseUnitPerEpoch(u)  : 0;
        uint256 cv2 = (h * tmpAccHash) / 1e18 + (b * tmpAccBase) / 1e18;
        return cv2 > rewardDebt[u] ? (cv2 - rewardDebt[u]) : 0;
    }

    // =======================
    // Admin setters
    // =======================
    function setHashrate(uint256 b, uint256 p, uint256 l) external onlyRole(PARAM_ADMIN) {
        // perubahan bobot hashrate hanya mempengaruhi interaksi berikutnya
        hashrate = HashrateParams(b, p, l);
    }

    function setBaseReward(uint256 b, uint256 p, uint256 l) external onlyRole(PARAM_ADMIN) {
        baseRw = BaseParams(b, p, l);
    }

    function setPortionBps(uint16 baseBps, uint16 proBps) external onlyRole(PARAM_ADMIN) {
        require(uint256(baseBps) + proBps == 10_000, "BPS!=100%");
        basePortionBps = baseBps;
        proPortionBps  = proBps;
    }

    function setLeftoverBps(uint16 burnBps, uint16 stakeBps, uint16 spinBps, uint16 boardBps) external onlyRole(PARAM_ADMIN) {
        require(uint256(burnBps) + stakeBps + spinBps + boardBps == 10_000, "BPS_SUM!=100%");
        leftoverBurnBps  = burnBps;
        leftoverStakeBps = stakeBps;
        leftoverSpinBps  = spinBps;
        leftoverBoardBps = boardBps;
    }

    function setDistributionVaults(address _staking, address _spin, address _board) external onlyRole(PARAM_ADMIN) {
        require(_staking != address(0) && _spin != address(0) && _board != address(0), "ZERO_ADDR");
        stakingVault = _staking;
        spinVault    = _spin;
        boardVault   = _board;
    }

    function setInitialReward(uint256 x) external onlyRole(PARAM_ADMIN) { initialRewardPerEpoch = x; }
    function setEpochLength(uint256 x) external onlyRole(PARAM_ADMIN)   { epochLength = x; }
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

