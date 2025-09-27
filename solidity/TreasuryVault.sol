// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @title TreasuryVault — penampung hasil penjualan (ETH & ERC20)
/// @notice Owner pegang DEFAULT_ADMIN_ROLE; bisa tambah OPERATOR_ROLE untuk penarikan terdelegasi.
contract TreasuryVault is AccessControl, Pausable, ReentrancyGuard {
    using Address for address payable;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    event WithdrawETH(address indexed to, uint256 amount);
    event WithdrawERC20(address indexed token, address indexed to, uint256 amount);
    event Received(address indexed from, uint256 amount);

    constructor(address initialAdmin) {
        require(initialAdmin != address(0), "bad admin");
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
    }

    // ===== Admin =====
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    function setOperator(address op, bool enabled) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (enabled) _grantRole(OPERATOR_ROLE, op);
        else _revokeRole(OPERATOR_ROLE, op);
    }

    // ===== Withdraw =====
    /// @dev Owner & Operator boleh tarik. Operator memudahkan delegasi tanpa memberi admin penuh.
    function withdrawETH(address payable to, uint256 amount)
        external
        whenNotPaused
        nonReentrant
        onlyRoleOrOperator
    {
        require(to != address(0), "bad to");
        require(amount <= address(this).balance, "insufficient ETH");
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

