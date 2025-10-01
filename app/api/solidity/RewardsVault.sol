// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title RewardsVault — pool reward BASETC untuk klaim harian
/// @notice GameCore punya GAME_ROLE untuk payout & burn sisa pool.
contract RewardsVault is AccessControl, ReentrancyGuard {
    bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE");

    IERC20 public immutable token; // BASETC

    event Deposited(address indexed from, uint256 amount);
    event PaidOut(address indexed to, uint256 amount);
    event Burned(uint256 amount);
    event Rescued(address indexed to, uint256 amount);

    constructor(address baseTc, address initialAdmin) {
        require(baseTc != address(0) && initialAdmin != address(0), "bad addr");
        token = IERC20(baseTc);
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
    }

    /// @notice Admin tambah/hapus GameCore sebagai eksekutor
    function setGameRole(address gameCore, bool enabled) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (enabled) _grantRole(GAME_ROLE, gameCore);
        else _revokeRole(GAME_ROLE, gameCore);
    }

    /// @notice Isi pool (harus approve dulu di token)
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "amount=0");
        require(token.transferFrom(msg.sender, address(this), amount), "transferFrom failed");
        emit Deposited(msg.sender, amount);
    }

    /// @notice Bayar reward ke user (dipanggil GameCore)
    function payout(address to, uint256 amount) external onlyRole(GAME_ROLE) nonReentrant {
        require(to != address(0) && amount > 0, "bad params");
        require(token.transfer(to, amount), "transfer failed");
        emit PaidOut(to, amount);
    }

    /// @notice Burn sisa pool (opsional) — kirim ke 0xdead
    function burn(uint256 amount) external onlyRole(GAME_ROLE) nonReentrant {
        require(amount > 0, "amount=0");
        require(token.transfer(0x000000000000000000000000000000000000dEaD, amount), "burn transfer failed");
        emit Burned(amount);
    }

    /// @notice Emergency rescue oleh admin
    function rescue(address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        require(to != address(0) && amount > 0, "bad params");
        require(token.transfer(to, amount), "rescue failed");
        emit Rescued(to, amount);
    }

    /// @notice Lihat saldo vault
    function balance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }
}

