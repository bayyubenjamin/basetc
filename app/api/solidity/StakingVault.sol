// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * StakingVault (BaseTC vFinal)
 * - Token stake & reward: BaseTC (ERC-20)
 * - Reward source: GameCore (authorized funder) + Admin top-up (owner)
 * - Distribusi: APR linear, via accRewardPerShare (MasterChef-style)
 * - Lock: 30 / 90 / 365 hari (multiplier 1.00x / 1.20x / 1.50x)
 * - Boost: claim-time check (tidak escrow NFT), cooldown 48h:
 *      Pro  = +5% / NFT (max 5 = +25%)
 *      Legend = +8% / NFT (max 3 = +24%)
 *      Cap total boost = 50%
 * - NFT tetap bisa dipakai mining (karena tidak di-escrow)
 * - Safe: Ownable, ReentrancyGuard, SafeERC20
 *
 * Catatan penting:
 * - Model "TWAB" di sini diterapkan secara praktis via distribusi incremental:
 *   selama user tetap bertahan (tidak unstake), dia ikut andil pada setiap depositReward.
 *   Makin lama stay -> makin banyak batch reward yang dia ambil (efek time-weighted).
 * - Boost dihitung saat settle/claim. Saat boost berubah, kontrak "settle" dulu pending
 *   dengan weight lama, lalu mengupdate effective weight untuk periode berikutnya.
 */

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address a) external view returns (uint256);
    function transfer(address to, uint256 v) external returns (bool);
    function allowance(address o, address s) external view returns (uint256);
    function approve(address s, uint256 v) external returns (bool);
    function transferFrom(address f, address t, uint256 v) external returns (bool);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

library SafeERC20 {
    function safeTransfer(IERC20 t, address to, uint256 v) internal {
        require(t.transfer(to, v), "TRANSFER_FAIL");
    }
    function safeTransferFrom(IERC20 t, address f, address to, uint256 v) internal {
        require(t.transferFrom(f, to, v), "TRANSFER_FROM_FAIL");
    }
    function safeApprove(IERC20 t, address s, uint256 v) internal {
        require(t.approve(s, v), "APPROVE_FAIL");
    }
}

abstract contract ReentrancyGuard {
    uint256 private _rg;
    constructor(){ _rg = 1; }
    modifier nonReentrant(){
        require(_rg == 1, "REENTRANT");
        _rg = 2;
        _;
        _rg = 1;
    }
}

abstract contract Ownable {
    address public owner;
    event OwnershipTransferred(address indexed prev, address indexed next);
    constructor(){ owner = msg.sender; emit OwnershipTransferred(address(0), msg.sender); }
    modifier onlyOwner(){ require(msg.sender == owner, "NOT_OWNER"); _; }
    function transferOwnership(address n) external onlyOwner {
        require(n != address(0), "ZERO_ADDR");
        emit OwnershipTransferred(owner, n);
        owner = n;
    }
}

// Minimal ERC1155 balance checker untuk RigNFT
interface IRigNFT {
    function balanceOf(address account, uint256 id) external view returns (uint256);
}

contract StakingVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                                TOKEN & FUNDERS
    //////////////////////////////////////////////////////////////*/
    IERC20 public immutable baseTC;

    mapping(address => bool) public isFunder; // GameCore + admin ops
    event FunderSet(address indexed funder, bool allowed);

    /*//////////////////////////////////////////////////////////////
                           LOCK & BOOST CONFIG
    //////////////////////////////////////////////////////////////*/
    // Multiplier basis points (10000 = 1.0x)
    uint16 public constant BPS = 10000;
    uint16 public lock30MultBps = 10000; // 1.00x
    uint16 public lock90MultBps = 12000; // 1.20x
    uint16 public lock365MultBps = 15000; // 1.50x

    uint32 public constant LOCK_30_D   = 30 days;
    uint32 public constant LOCK_90_D   = 90 days;
    uint32 public constant LOCK_365_D  = 365 days;

    // Boost config (claim-time)
    IRigNFT public rigNFT;
    uint256 public proId;     // ERC1155 token id untuk Pro
    uint256 public legendId;  // ERC1155 token id untuk Legend
    uint8   public maxProPerWallet    = 5;
    uint8   public maxLegendPerWallet = 3;
    uint16  public proBoostPerNFTBps  = 500;  // +5% per Pro
    uint16  public legendBoostPerNFTBps = 800; // +8% per Legend
    uint16  public maxBoostCapBps     = 5000; // 50% cap (guardrail)
    uint32  public boostHoldCooldown  = 48 hours; // wajib pegang >= 48 jam sebelum boost aktif

    /*//////////////////////////////////////////////////////////////
                             REWARD ACCOUNTING
    //////////////////////////////////////////////////////////////*/
    // accRewardPerShare menggunakan "effective weight" (amount * lockMult * (1+boost) saat terakhir settle).
    uint256 public accRewardPerShare; // 1e18
    uint256 public totalEffectiveWeight; // agregat effective weight
    uint256 public pendingInjection; // reward tertahan saat pool weight = 0

    // Ditambah untuk akurasi deposit (token deflasi/fee-on-transfer)
    uint256 private _lastVaultBalance;

    /*//////////////////////////////////////////////////////////////
                              USER STATE
    //////////////////////////////////////////////////////////////*/
    struct Tranche {
        uint128 amount;
        uint32  lockUntil;
        uint16  lockMultBps; // 10000/12000/15000
    }

    struct User {
        uint256 rewardDebt;         // effectiveWeight * acc / 1e18 (pada checkpoint terakhir)
        uint256 unclaimed;          // akumulasi pending saat settle, dibayar saat claim()
        uint256 baseWeight;         // sum(amount * lockMultBps / BPS) tanpa boost
        uint256 effectiveWeight;    // baseWeight * (1 + boostBps/BPS) pada checkpoint terakhir
        uint48  lastActionAt;       // waktu terakhir stake/unstake/claim (basis cooldown)
        Tranche[] tranches;         // posisi staking terkunci
    }
    mapping(address => User) private users;

    /*//////////////////////////////////////////////////////////////
                               EVENTS
    //////////////////////////////////////////////////////////////*/
    event Staked(address indexed user, uint256 amount, uint32 lockUntil, uint16 lockMultBps);
    event Unstaked(address indexed user, uint256 amount);
    event Claimed(address indexed user, uint256 amount);
    event DepositReward(address indexed from, uint256 amount, uint256 injected, uint256 newAcc);
    event RigConfigUpdated(address rig, uint256 proId, uint256 legendId);
    event BoostParamsUpdated(uint16 proBps, uint16 legendBps, uint16 capBps, uint32 cooldown);
    event LockMultiplierUpdated(uint16 m30, uint16 m90, uint16 m365);

    /*//////////////////////////////////////////////////////////////
                               CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    constructor(IERC20 _baseTC) {
        require(address(_baseTC) != address(0), "ZERO_TOKEN");
        baseTC = _baseTC;
        _lastVaultBalance = 0;
    }

    /*//////////////////////////////////////////////////////////////
                           OWNER / ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    function setFunder(address funder, bool allowed) external onlyOwner {
        isFunder[funder] = allowed;
        emit FunderSet(funder, allowed);
    }

    function setRigNFT(address rig, uint256 _proId, uint256 _legendId) external onlyOwner {
        rigNFT = IRigNFT(rig);
        proId = _proId;
        legendId = _legendId;
        emit RigConfigUpdated(rig, _proId, _legendId);
    }

    function setBoostParams(uint16 proBps, uint16 legendBps, uint16 capBps, uint32 cooldown) external onlyOwner {
        require(capBps <= 10000, "CAP>100%");
        proBoostPerNFTBps = proBps;
        legendBoostPerNFTBps = legendBps;
        maxBoostCapBps = capBps;
        boostHoldCooldown = cooldown;
        emit BoostParamsUpdated(proBps, legendBps, capBps, cooldown);
    }

    function setLockMultipliers(uint16 m30, uint16 m90, uint16 m365) external onlyOwner {
        require(m30 >= 10000 && m90 >= 10000 && m365 >= 10000, "BAD_MULT");
        lock30MultBps = m30;
        lock90MultBps = m90;
        lock365MultBps = m365;
        emit LockMultiplierUpdated(m30, m90, m365);
    }

    /*//////////////////////////////////////////////////////////////
                              CORE LOGIC
    //////////////////////////////////////////////////////////////*/

    // ======== FUNDING (GameCore/Admin) ========
    function depositReward(uint256 amount) external nonReentrant {
        require(isFunder[msg.sender] || msg.sender == owner, "NOT_FUNDER");
        require(amount > 0, "AMOUNT=0");

        // Transfer in and measure delta (for fee-on-transfer tokens)
        uint256 beforeBal = baseTC.balanceOf(address(this));
        baseTC.safeTransferFrom(msg.sender, address(this), amount);
        uint256 afterBal = baseTC.balanceOf(address(this));
        uint256 received = afterBal - beforeBal;

        uint256 injectAmount = received + pendingInjection;

        if (totalEffectiveWeight == 0) {
            // Tidak ada staker aktif -> tahan dulu
            pendingInjection = injectAmount;
        } else {
            accRewardPerShare += (injectAmount * 1e18) / totalEffectiveWeight;
            pendingInjection = 0;
        }

        _lastVaultBalance = afterBal;
        emit DepositReward(msg.sender, amount, injectAmount, accRewardPerShare);
    }

    // ======== STAKE ========
    enum LockClass { D30, D90, D365 }

    function stake(uint256 amount, LockClass lockClass) external nonReentrant {
        require(amount > 0, "AMOUNT=0");
        User storage u = users[msg.sender];

        // 1) settle pending berdasar effectiveWeight lama
        _settle(msg.sender, u);

        // 2) hitung lockUntil + lockMultBps
        (uint32 dur, uint16 mult) = _lockParams(lockClass);
        uint32 until = uint32(block.timestamp) + dur;

        // 3) transfer token masuk
        baseTC.safeTransferFrom(msg.sender, address(this), amount);

        // 4) push tranche
        u.tranches.push(Tranche({
            amount: _toU128(amount),
            lockUntil: until,
            lockMultBps: mult
        }));

        // 5) update baseWeight (tanpa boost)
        uint256 addBase = (amount * mult) / BPS;
        u.baseWeight += addBase;

        // 6) apply boost baru (claim-time check berdasar cooldown dari lastActionAt)
        uint16 boostBps = _currentBoostBps(msg.sender, u);
        uint256 newEff = (u.baseWeight * (BPS + boostBps)) / BPS;

        // 7) adjust totalEffectiveWeight
        totalEffectiveWeight = totalEffectiveWeight + newEff - u.effectiveWeight;
        u.effectiveWeight = newEff;

        // 8) update rewardDebt sesuai acc saat ini
        u.rewardDebt = (u.effectiveWeight * accRewardPerShare) / 1e18;

        // 9) set lastActionAt
        u.lastActionAt = uint48(block.timestamp);

        _lastVaultBalance = baseTC.balanceOf(address(this));
        emit Staked(msg.sender, amount, until, mult);
    }

    // ======== UNSTAKE (parsial / multi-tranche) ========
    function unstake(uint256[] calldata trancheIdx, uint256[] calldata amounts) external nonReentrant {
        require(trancheIdx.length == amounts.length && trancheIdx.length > 0, "BAD_ARGS");
        User storage u = users[msg.sender];

        // 1) settle pending dengan effectiveWeight lama
        _settle(msg.sender, u);

        uint256 totalOut = 0;
        for (uint256 i = 0; i < trancheIdx.length; i++) {
            uint256 idx = trancheIdx[i];
            require(idx < u.tranches.length, "IDX_OOB");
            Tranche storage t = u.tranches[idx];
            require(block.timestamp >= t.lockUntil, "LOCKING");
            uint256 take = amounts[i];
            require(take > 0 && take <= t.amount, "BAD_AMT");

            t.amount = uint128(uint256(t.amount) - take);
            totalOut += take;

            // kurangi baseWeight
            uint256 subBase = (take * t.lockMultBps) / BPS;
            u.baseWeight -= subBase;
        }

        // bersihkan elemen zero-amount di belakang (opsional)
        _compactTranches(u);

        // update effective weight dgn boost saat ini
        uint16 boostBps = _currentBoostBps(msg.sender, u);
        uint256 newEff = (u.baseWeight * (BPS + boostBps)) / BPS;
        totalEffectiveWeight = totalEffectiveWeight + newEff - u.effectiveWeight;
        u.effectiveWeight = newEff;

        // update rewardDebt
        u.rewardDebt = (u.effectiveWeight * accRewardPerShare) / 1e18;

        // transfer token keluar
        if (totalOut > 0) {
            baseTC.safeTransfer(msg.sender, totalOut);
        }

        u.lastActionAt = uint48(block.timestamp);
        _lastVaultBalance = baseTC.balanceOf(address(this));
        emit Unstaked(msg.sender, totalOut);
    }

    // ======== CLAIM ========
    function claim() external nonReentrant {
        User storage u = users[msg.sender];

        // settle pending pakai effectiveWeight lama
        _settle(msg.sender, u);

        uint256 toPay = u.unclaimed;
        require(toPay > 0, "NO_REWARD");

        u.unclaimed = 0;
        baseTC.safeTransfer(msg.sender, toPay);

        // update debt setelah pembayaran (effectiveWeight dan acc sudah di-refresh di _settle)
        u.rewardDebt = (u.effectiveWeight * accRewardPerShare) / 1e18;
        u.lastActionAt = uint48(block.timestamp);
        _lastVaultBalance = baseTC.balanceOf(address(this));
        emit Claimed(msg.sender, toPay);
    }

    /*//////////////////////////////////////////////////////////////
                           INTERNAL HELPERS
    //////////////////////////////////////////////////////////////*/

    function _settle(address account, User storage u) internal {
        // hitung pending berbasis effectiveWeight lama
        if (u.effectiveWeight > 0) {
            uint256 accrued = (u.effectiveWeight * accRewardPerShare) / 1e18;
            if (accrued > u.rewardDebt) {
                u.unclaimed += (accrued - u.rewardDebt);
            }
        }

        // hitung boost eligibility saat ini (claim-time rule + cooldown)
        uint16 boostBps = _currentBoostBps(account, u);

        // refresh effective weight untuk periode berikutnya
        uint256 newEff = (u.baseWeight * (BPS + boostBps)) / BPS;
        if (newEff != u.effectiveWeight) {
            totalEffectiveWeight = totalEffectiveWeight + newEff - u.effectiveWeight;
            u.effectiveWeight = newEff;
        }

        // refresh rewardDebt ke checkpoint baru
        u.rewardDebt = (u.effectiveWeight * accRewardPerShare) / 1e18;
    }

    function _currentBoostBps(address account, User storage u) internal view returns (uint16) {
        // cooldown: harus >= 48 jam sejak aksi terakhir
        if (block.timestamp < uint256(u.lastActionAt) + uint256(boostHoldCooldown)) {
            return 0;
        }
        // jika rigNFT belum diset -> tidak ada boost
        if (address(rigNFT) == address(0)) return 0;

        uint256 pro = rigNFT.balanceOf(account, proId);
        uint256 leg = rigNFT.balanceOf(account, legendId);

        if (pro == 0 && leg == 0) return 0;

        if (pro > maxProPerWallet) pro = maxProPerWallet;
        if (leg > maxLegendPerWallet) leg = maxLegendPerWallet;

        uint256 boost = pro * proBoostPerNFTBps + leg * legendBoostPerNFTBps;
        if (boost > maxBoostCapBps) boost = maxBoostCapBps;
        return uint16(boost);
    }

    function _lockParams(LockClass c) internal view returns (uint32 dur, uint16 mult) {
        if (c == LockClass.D30) { return (LOCK_30_D, lock30MultBps); }
        if (c == LockClass.D90) { return (LOCK_90_D, lock90MultBps); }
        return (LOCK_365_D, lock365MultBps);
    }

    function _compactTranches(User storage u) internal {
        uint256 len = u.tranches.length;
        // hapus trailing zero-amount tranches
        while (len > 0 && u.tranches[len-1].amount == 0) {
            u.tranches.pop();
            len--;
        }
    }

    function _toU128(uint256 v) private pure returns (uint128) {
        require(v <= type(uint128).max, "OVERFLOW_U128");
        return uint128(v);
    }

    /*//////////////////////////////////////////////////////////////
                                 VIEWS
    //////////////////////////////////////////////////////////////*/
    function pendingReward(address account) external view returns (uint256) {
        User storage u = users[account];
        uint256 _acc = accRewardPerShare;
        uint256 eff = u.effectiveWeight;

        // simulasi jika ada pendingInjection dan ada totalEffectiveWeight
        if (pendingInjection > 0 && totalEffectiveWeight > 0) {
            _acc = _acc + (pendingInjection * 1e18) / totalEffectiveWeight;
        }

        uint256 pending = u.unclaimed;
        if (eff > 0) {
            uint256 accrued = (eff * _acc) / 1e18;
            if (accrued > u.rewardDebt) {
                pending += (accrued - u.rewardDebt);
            }
        }
        return pending;
    }

    function getUser(address account) external view returns (
        uint256 baseWeight,
        uint256 effectiveWeight,
        uint48  lastActionAt,
        uint256 unclaimed,
        Tranche[] memory tranches
    ) {
        User storage u = users[account];
        return (u.baseWeight, u.effectiveWeight, u.lastActionAt, u.unclaimed, u.tranches);
    }

    function getGlobal() external view returns (
        uint256 _totalEffectiveWeight,
        uint256 _accRewardPerShare,
        uint256 _pendingInjection
    ) {
        return (totalEffectiveWeight, accRewardPerShare, pendingInjection);
    }
}
