// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * StakingVault (Fixed Rate Mining Model)
 * - Reward System: FIXED RATE (Mining Style)
 * - Admin menentukan "Reward Per Detik" (misal: 0.03 token/detik).
 * - Admin bisa Top Up saldo kapan saja tanpa mengubah Rate.
 * - Top Up hanya akan memperpanjang "Umur" (periodFinish) dari mining.
 */

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address a) external view returns (uint256);
    function transfer(address to, uint256 v) external returns (bool);
    function allowance(address o, address s) external view returns (uint256);
    function approve(address s, uint256 v) external returns (bool);
    function transferFrom(address f, address t, uint256 v) external returns (bool);
}

library SafeERC20 {
    function safeTransfer(IERC20 t, address to, uint256 v) internal {
        require(t.transfer(to, v), "TRANSFER_FAIL");
    }
    function safeTransferFrom(IERC20 t, address f, address to, uint256 v) internal {
        require(t.transferFrom(f, to, v), "TRANSFER_FROM_FAIL");
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

interface IRigNFT {
    function balanceOf(address account, uint256 id) external view returns (uint256);
}

contract StakingVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable baseTC;
    mapping(address => bool) public isFunder; 

    // --- LOCK CONFIG (TETAP) ---
    uint16 public constant BPS = 10000;
    uint16 public lock30MultBps = 10000; 
    uint16 public lock90MultBps = 12000; 
    uint16 public lock365MultBps = 15000; 

    uint32 public constant LOCK_30_D   = 30 days;
    uint32 public constant LOCK_90_D   = 90 days;
    uint32 public constant LOCK_365_D  = 365 days;

    // --- BOOST CONFIG (TETAP) ---
    IRigNFT public rigNFT;
    uint256 public proId;     
    uint256 public legendId;  
    uint8   public maxProPerWallet    = 5;
    uint8   public maxLegendPerWallet = 3;
    uint16  public proBoostPerNFTBps  = 500;  
    uint16  public legendBoostPerNFTBps = 800; 
    uint16  public maxBoostCapBps     = 5000; 
    uint32  public boostHoldCooldown  = 48 hours; 

    // --- MINING STATE (BARU) ---
    uint256 public rewardRate = 0;       // Token per detik (Wei)
    uint256 public periodFinish = 0;     // Kapan saldo reward diperkirakan habis
    uint256 public lastUpdateTime;
    uint256 public accRewardPerShare; 
    
    uint256 public totalEffectiveWeight; // Total Share Pool

    struct Tranche {
        uint128 amount;
        uint32  lockUntil;
        uint16  lockMultBps; 
    }

    struct User {
        uint256 rewardDebt;         
        uint256 unclaimed;          
        uint256 baseWeight;         
        uint256 effectiveWeight;    
        uint48  lastActionAt;       
        Tranche[] tranches;         
    }
    mapping(address => User) private users;

    // Events
    event Staked(address indexed user, uint256 amount, uint32 lockUntil, uint16 lockMultBps);
    event Unstaked(address indexed user, uint256 amount);
    event Claimed(address indexed user, uint256 amount);
    event RateUpdated(uint256 newRate, uint256 newPeriodFinish);
    event RewardsTopUp(uint256 amount, uint256 newPeriodFinish);

    constructor(IERC20 _baseTC) {
        baseTC = _baseTC;
    }

    // --- MODIFIER UPDATE POOL ---
    modifier updatePool(address account) {
        accRewardPerShare = rewardPerToken(); 
        lastUpdateTime = lastTimeRewardApplicable();
        
        if (account != address(0)) {
            // Kita tidak pakai _settle di modifier, tapi manual di function agar hemat gas
        }
        _;
    }

    // --- ADMIN CONFIG ---
    function setFunder(address funder, bool allowed) external onlyOwner {
        isFunder[funder] = allowed;
    }

    function setRigNFT(address rig, uint256 _proId, uint256 _legendId) external onlyOwner {
        rigNFT = IRigNFT(rig);
        proId = _proId;
        legendId = _legendId;
    }

    // [PENTING] Set Kecepatan Mining (Token per Detik)
    // Contoh: Mau 80.000 token per bulan?
    // 80000 / (30 * 24 * 3600) = 0.030864...
    // Masukkan dalam Wei: 30864197530864197
    function setRewardRate(uint256 _ratePerSec) external onlyOwner updatePool(address(0)) {
        rewardRate = _ratePerSec;
        _updatePeriodFinish();
        emit RateUpdated(rewardRate, periodFinish);
    }

    // [PENTING] Top Up Saldo Reward (Isi Bensin)
    // Bisa dipanggil kapan saja, jumlah berapa saja. 
    // Tidak mengubah Rate, hanya memperpanjang umur mining.
    function topUpReward(uint256 amount) external nonReentrant updatePool(address(0)) {
        require(isFunder[msg.sender] || msg.sender == owner, "NOT_FUNDER");
        require(rewardRate > 0, "SET_RATE_FIRST");
        
        baseTC.safeTransferFrom(msg.sender, address(this), amount);
        _updatePeriodFinish();
        
        emit RewardsTopUp(amount, periodFinish);
    }

    // Hitung ulang kapan saldo akan habis berdasarkan saldo saat ini / rate
    function _updatePeriodFinish() internal {
        if (rewardRate == 0) {
            periodFinish = block.timestamp;
            return;
        }
        uint256 currentBalance = baseTC.balanceOf(address(this));
        // Estimasi durasi sisa = Saldo / Rate
        uint256 durationLeft = currentBalance / rewardRate;
        periodFinish = block.timestamp + durationLeft;
    }

    // --- USER ACTIONS ---

    function stake(uint256 amount, uint8 lockType) external nonReentrant updatePool(msg.sender) {
        require(amount > 0, "Amount 0");
        User storage u = users[msg.sender];
        _settle(msg.sender, u); 

        uint32 dur = LOCK_30_D;
        uint16 mult = lock30MultBps;
        if (lockType == 1) { dur = LOCK_90_D; mult = lock90MultBps; }
        if (lockType == 2) { dur = LOCK_365_D; mult = lock365MultBps; }
        
        uint32 until = uint32(block.timestamp) + dur;
        
        baseTC.safeTransferFrom(msg.sender, address(this), amount);

        u.tranches.push(Tranche({
            amount: uint128(amount),
            lockUntil: until,
            lockMultBps: mult
        }));

        u.baseWeight += (amount * mult) / BPS;
        _updateEffectiveWeight(msg.sender, u);
        
        u.lastActionAt = uint48(block.timestamp);
        emit Staked(msg.sender, amount, until, mult);
    }

    function unstake(uint256[] calldata trancheIdx, uint256[] calldata amounts) external nonReentrant updatePool(msg.sender) {
        User storage u = users[msg.sender];
        _settle(msg.sender, u);

        uint256 totalOut = 0;
        for (uint256 i = 0; i < trancheIdx.length; i++) {
            uint256 idx = trancheIdx[i];
            Tranche storage t = u.tranches[idx];
            require(block.timestamp >= t.lockUntil, "Locked");
            uint256 take = amounts[i];
            require(take <= t.amount, "Bad amt");

            t.amount = uint128(uint256(t.amount) - take);
            totalOut += take;

            uint256 subBase = (take * t.lockMultBps) / BPS;
            if(subBase > u.baseWeight) u.baseWeight = 0; 
            else u.baseWeight -= subBase;
        }

        _updateEffectiveWeight(msg.sender, u);
        if (totalOut > 0) baseTC.safeTransfer(msg.sender, totalOut);
        
        u.lastActionAt = uint48(block.timestamp);
        emit Unstaked(msg.sender, totalOut);
    }

    function claim() external nonReentrant updatePool(msg.sender) {
        User storage u = users[msg.sender];
        _settle(msg.sender, u);

        uint256 payout = u.unclaimed;
        if (payout > 0) {
            u.unclaimed = 0;
            baseTC.safeTransfer(msg.sender, payout);
            emit Claimed(msg.sender, payout);
            // Cek saldo lagi utk update finish time yg akurat (opsional, gas saving: skip)
        }
        _updateEffectiveWeight(msg.sender, u); 
        u.lastActionAt = uint48(block.timestamp);
    }

    // --- INTERNAL & VIEWS ---

    function rewardPerToken() public view returns (uint256) {
        if (totalEffectiveWeight == 0) return accRewardPerShare;
        return accRewardPerShare + (
            ((lastTimeRewardApplicable() - lastUpdateTime) * rewardRate * 1e18) / totalEffectiveWeight
        );
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return block.timestamp < periodFinish ? block.timestamp : periodFinish;
    }

    function _settle(address, User storage u) internal {
        uint256 accrued = (u.effectiveWeight * accRewardPerShare) / 1e18;
        uint256 pending = accrued - u.rewardDebt;
        if (pending > 0) u.unclaimed += pending;
        u.rewardDebt = (u.effectiveWeight * accRewardPerShare) / 1e18;
    }

    function _updateEffectiveWeight(address account, User storage u) internal {
        uint16 boostBps = 0;
        if (block.timestamp >= uint256(u.lastActionAt) + uint256(boostHoldCooldown)) {
             if (address(rigNFT) != address(0)) {
                uint256 pro = rigNFT.balanceOf(account, proId);
                uint256 leg = rigNFT.balanceOf(account, legendId);
                
                if (pro > maxProPerWallet) pro = maxProPerWallet;
                if (leg > maxLegendPerWallet) leg = maxLegendPerWallet;
                
                uint256 b = (pro * proBoostPerNFTBps) + (leg * legendBoostPerNFTBps);
                if (b > maxBoostCapBps) b = maxBoostCapBps;
                boostBps = uint16(b);
             }
        }
        uint256 newEff = (u.baseWeight * (BPS + boostBps)) / BPS;
        totalEffectiveWeight = totalEffectiveWeight + newEff - u.effectiveWeight;
        u.effectiveWeight = newEff;
        u.rewardDebt = (u.effectiveWeight * accRewardPerShare) / 1e18;
    }

    // Info Front End
    function pendingReward(address account) external view returns (uint256) {
        User storage u = users[account];
        uint256 _acc = rewardPerToken();
        return u.unclaimed + ((u.effectiveWeight * _acc) / 1e18 - u.rewardDebt);
    }
    
    function getUser(address account) external view returns (
        uint256 baseWeight, uint256 effectiveWeight, uint48 lastActionAt, uint256 unclaimed, Tranche[] memory tranches
    ) {
        User storage u = users[account];
        return (u.baseWeight, u.effectiveWeight, u.lastActionAt, u.unclaimed, u.tranches);
    }

    // Info Sisa Waktu Mining
    function getMiningDurationLeft() external view returns (uint256) {
        if (block.timestamp >= periodFinish) return 0;
        return periodFinish - block.timestamp;
    }

    function proIdData() external view returns (uint256) { return proId; }
    function legendIdData() external view returns (uint256) { return legendId; }
}
