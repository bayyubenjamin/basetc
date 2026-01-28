// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title RewardsVault — High Performance Reward Pool
/// @notice Mengelola distribusi reward BASETC dengan keamanan tingkat tinggi dan efisiensi gas.
contract RewardsVault is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // --- Roles ---
    bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // --- State Variables ---
    IERC20 public immutable token; // BASETC
    uint256 public totalRewardsDistributed; // On-chain metric (High Impact Data)

    // --- Events ---
    event Deposited(address indexed from, uint256 amount);
    event PaidOut(address indexed to, uint256 amount);
    event BatchPaidOut(uint256 recipientCount, uint256 totalAmount);
    event Burned(uint256 amount);
    event Rescued(address indexed to, uint256 amount);

    // --- Custom Errors (Gas Saving) ---
    error RewardsVault__ZeroAddress();
    error RewardsVault__ZeroAmount();
    error RewardsVault__ArrayMismatch();
    error RewardsVault__TransferFailed();

    constructor(address baseTc, address initialAdmin) {
        if (baseTc == address(0) || initialAdmin == address(0)) revert RewardsVault__ZeroAddress();
        
        token = IERC20(baseTc);
        
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(PAUSER_ROLE, initialAdmin);
    }

    // --- Admin Functions ---

    /// @notice Mengatur role GameCore
    function setGameRole(address gameCore, bool enabled) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (gameCore == address(0)) revert RewardsVault__ZeroAddress();
        if (enabled) _grantRole(GAME_ROLE, gameCore);
        else _revokeRole(GAME_ROLE, gameCore);
    }

    /// @notice Emergency Pause: Hentikan payout jika ada exploit
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /// @notice Resume operasional
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // --- Core Features ---

    /// @notice Isi pool reward (siapapun bisa deposit)
    function deposit(uint256 amount) external nonReentrant {
        if (amount == 0) revert RewardsVault__ZeroAmount();
        
        // Menggunakan safeTransferFrom untuk kompatibilitas token maksimal
        token.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount);
    }

    /// @notice Bayar reward ke satu user
    function payout(address to, uint256 amount) external onlyRole(GAME_ROLE) whenNotPaused nonReentrant {
        if (to == address(0)) revert RewardsVault__ZeroAddress();
        if (amount == 0) revert RewardsVault__ZeroAmount();

        totalRewardsDistributed += amount;
        token.safeTransfer(to, amount);
        
        emit PaidOut(to, amount);
    }

    /// @notice [HIGH IMPACT] Bayar reward ke BANYAK user sekaligus (Hemat Gas)
    /// @dev Sangat berguna untuk distribusi reward akhir season/harian
    function payoutBatch(address[] calldata recipients, uint256[] calldata amounts) external onlyRole(GAME_ROLE) whenNotPaused nonReentrant {
        if (recipients.length != amounts.length) revert RewardsVault__ArrayMismatch();
        
        uint256 totalPayout = 0;
        uint256 len = recipients.length;

        for (uint256 i = 0; i < len; ) {
            address to = recipients[i];
            uint256 amount = amounts[i];

            if (to != address(0) && amount > 0) {
                token.safeTransfer(to, amount);
                totalPayout += amount;
            }

            unchecked { ++i; } // Gas optimization loop
        }

        totalRewardsDistributed += totalPayout;
        emit BatchPaidOut(len, totalPayout);
    }

    /// @notice Burn sisa pool ke Dead Address
    function burn(uint256 amount) external onlyRole(GAME_ROLE) nonReentrant {
        if (amount == 0) revert RewardsVault__ZeroAmount();
        
        // 0xdead adalah standar burn address di EVM
        token.safeTransfer(0x000000000000000000000000000000000000dEaD, amount);
        emit Burned(amount);
    }

    /// @notice Emergency rescue oleh admin (hanya jika bukan token reward utama, atau situasi darurat)
    function rescue(address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        if (to == address(0)) revert RewardsVault__ZeroAddress();
        if (amount == 0) revert RewardsVault__ZeroAmount();
        
        token.safeTransfer(to, amount);
        emit Rescued(to, amount);
    }

    // --- View Functions ---

    function balance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }
}
