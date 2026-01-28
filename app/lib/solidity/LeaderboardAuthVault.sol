// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title LeaderboardAuthVault V2
 * @notice Vault untuk klaim reward leaderboard menggunakan verifikasi tanda tangan relayer (off-chain snapshot).
 */
contract LeaderboardAuthVault is AccessControl, ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    IERC20 public immutable token;

    uint256 public accountedBalance;
    uint256 public roundId;
    uint256 public roundPool;
    bool    public roundActive;

    mapping(address => uint256) public nonces;
    mapping(uint256 => mapping(address => bool)) public claimed;

    // Typehash sesuai standar EIP-712
    bytes32 public constant ACTION_TYPEHASH = keccak256(
        "UserAction(address user,uint256 roundId,uint256 amount,uint256 nonce,uint256 deadline)"
    );

    // --- Custom Errors ---
    error InvalidAddress();
    error RoundAlreadyActive();
    error NoRoundActive();
    error InsufficientFunds();
    error InvalidSignature();
    error SignatureExpired();
    error InvalidNonce();
    error AlreadyClaimed();
    error OnlySelfClaim();
    error ZeroAmount();
    error RoundMismatch();

    // --- Events ---
    event Skimmed(uint256 amount);
    event RoundStarted(uint256 indexed roundId, uint256 poolLocked);
    event RoundEnded(uint256 indexed roundId, uint256 leftoverReturned);
    event Claimed(uint256 indexed roundId, address indexed user, uint256 amount);
    event EmergencyRescue(address indexed to, uint256 amount);

    constructor(IERC20 _token, address admin) 
        EIP712("LeaderboardAuthVault", "1") 
    {
        if (address(_token) == address(0) || admin == address(0)) revert InvalidAddress();
        
        token = _token;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MANAGER_ROLE, admin);
        _grantRole(RELAYER_ROLE, admin);
    }

    /**
     * @dev Menghitung selisih saldo token yang masuk secara "asinkron" (direct transfer/payout).
     */
    function _skim() internal returns (uint256 newly) {
        uint256 bal = token.balanceOf(address(this));
        // accountedBalance tidak termasuk roundPool jika round sedang aktif
        uint256 currentTotal = roundActive ? (accountedBalance + roundPool) : accountedBalance;
        
        if (bal > currentTotal) {
            newly = bal - currentTotal;
            accountedBalance += newly;
            emit Skimmed(newly);
        }
    }

    // --- Admin Functions ---

    function startRound() external onlyRole(MANAGER_ROLE) {
        if (roundActive) revert RoundAlreadyActive();
        _skim();
        
        uint256 pool = accountedBalance;
        if (pool == 0) revert InsufficientFunds();

        roundId++;
        roundActive = true;
        roundPool = pool;
        accountedBalance = 0; // Pindahkan semua ke pool

        emit RoundStarted(roundId, pool);
    }

    function endRound() external onlyRole(MANAGER_ROLE) {
        if (!roundActive) revert NoRoundActive();
        
        uint256 leftover = roundPool;
        accountedBalance += leftover;
        roundPool = 0;
        roundActive = false;

        emit RoundEnded(roundId, leftover);
    }

    // --- User Functions ---

    /**
     * @notice Klaim reward menggunakan signature dari relayer.
     */
    function claimWithSig(
        address user,
        uint256 _roundId,
        uint256 amount,
        uint256 nonce,
        uint256 deadline,
        bytes calldata relayerSig
    ) external nonReentrant {
        if (msg.sender != user) revert OnlySelfClaim();
        if (block.timestamp > deadline) revert SignatureExpired();
        if (nonce != nonces[user]) revert InvalidNonce();
        if (amount == 0) revert ZeroAmount();

        if (roundActive) {
            if (_roundId != roundId) revert RoundMismatch();
            if (claimed[_roundId][user]) revert AlreadyClaimed();
        }

        // Verifikasi Signature via EIP-712 Helper
        bytes32 structHash = keccak256(abi.encode(
            ACTION_TYPEHASH,
            user,
            _roundId,
            amount,
            nonce,
            deadline
        ));
        
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, relayerSig);
        
        if (!hasRole(RELAYER_ROLE, signer)) revert InvalidSignature();

        // Update State
        nonces[user]++;
        if (roundActive) {
            claimed[_roundId][user] = true;
            if (amount > roundPool) revert InsufficientFunds();
            roundPool -= amount;
        } else {
            _skim();
            if (amount > accountedBalance) revert InsufficientFunds();
            accountedBalance -= amount;
        }

        // Transfer
        token.safeTransfer(user, amount);
        emit Claimed(_roundId, user, amount);
    }

    /**
     * @dev Fungsi darurat untuk memindahkan dana oleh Super Admin.
     */
    function rescue(address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _skim();
        if (amount > accountedBalance) revert InsufficientFunds();
        
        accountedBalance -= amount;
        token.safeTransfer(to, amount);
        emit EmergencyRescue(to, amount);
    }
}
