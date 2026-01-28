// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @title TreasuryVault v2 — Secure Asset Management with Rate Limiting
/// @notice Menambahkan fitur keamanan 'Daily Limit' untuk mencegah pengurasan dana (Anti-Drain).
contract TreasuryVault is AccessControl, Pausable, ReentrancyGuard {
    using Address for address payable;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // ==========================================
    // NEW: Security State Variables (High Impact)
    // ==========================================
    uint256 public dailyEthLimit;           // Batas maksimal penarikan ETH per hari
    uint256 public currentDayWithdrawn;     // Jumlah yang sudah ditarik hari ini
    uint256 public lastWithdrawDay;         // Penanda hari terakhir penarikan (timestamp / 1 days)

    event WithdrawETH(address indexed to, uint256 amount);
    event WithdrawERC20(address indexed token, address indexed to, uint256 amount);
    event Received(address indexed from, uint256 amount);
    event DailyLimitChanged(uint256 oldLimit, uint256 newLimit); // Event baru

    constructor(address initialAdmin, uint256 _dailyEthLimit) {
        require(initialAdmin != address(0), "bad admin");
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        
        // Inisialisasi limit awal (misal: 1000 ETH jika inputnya besar, atau sesuai kebutuhan)
        dailyEthLimit = _dailyEthLimit; 
    }

    // ===== Admin =====
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    function setOperator(address op, bool enabled) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (enabled) _grantRole(OPERATOR_ROLE, op);
        else _revokeRole(OPERATOR_ROLE, op);
    }

    /// @notice Update batas penarikan harian. Fitur krusial untuk manajemen resiko.
    function setDailyEthLimit(uint256 newLimit) external onlyRole(DEFAULT_ADMIN_ROLE) {
        emit DailyLimitChanged(dailyEthLimit, newLimit);
        dailyEthLimit = newLimit;
    }

    // ===== Withdraw with Rate Limiting =====
    
    /// @dev Menggunakan logika 'Rate Limiting' untuk keamanan aset.
    function withdrawETH(address payable to, uint256 amount)
        external
        whenNotPaused
        nonReentrant
        onlyRoleOrOperator
    {
        require(to != address(0), "bad to");
        require(amount <= address(this).balance, "insufficient ETH");

        // --- NEW: Security Logic Check ---
        uint256 today = block.timestamp / 1 days;
        
        // Reset counter jika hari berganti
        if (today > lastWithdrawDay) {
            currentDayWithdrawn = 0;
            lastWithdrawDay = today;
        }

        // Cek apakah penarikan melebihi sisa limit hari ini
        // (Hanya berlaku jika dailyEthLimit > 0. Jika 0 dianggap unlimited/locked tergantung kebijakan, 
        // di sini kita anggap limit aktif jika > 0).
        if (dailyEthLimit > 0) {
            require(currentDayWithdrawn + amount <= dailyEthLimit, "Daily ETH limit exceeded");
            currentDayWithdrawn += amount;
        }
        // ---------------------------------

        to.sendValue(amount);
        emit WithdrawETH(to, amount);
    }

    function withdrawERC20(address token, address to, uint256 amount)
        external
        whenNotPaused
        nonReentrant
        onlyRoleOrOperator
    {
        require(token != address(0) && to != address(0), "bad params");
        // ERC20 belum kita pasang limit harian agar hemat gas, tapi bisa ditambahkan jika perlu.
        require(IERC20(token).transfer(to, amount), "transfer failed");
        emit WithdrawERC20(token, to, amount);
    }

    // ===== Receive =====
    receive() external payable {
        emit Received(msg.sender, msg.value);
    }
    fallback() external payable {
        if (msg.value > 0) emit Received(msg.sender, msg.value);
    }

    // ===== Modifier =====
    modifier onlyRoleOrOperator() {
        require(
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender) || hasRole(OPERATOR_ROLE, msg.sender),
            "not authorized"
        );
        _;
    }
}
