// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * LeaderboardAuthVault — Off‑chain Snapshot, UI‑Gated Claims (Relayer‑signed)
 *
 * Tujuan paling simpel:
 * - Vault cuma NAMPUNG reward leaderboard (dari GameCore -> RewardsVault.payout -> sini).
 * - Daftar pemenang & jumlah klaim DITENTUKAN OFF‑CHAIN (di server/relayer UI).
 * - User klaim SEKALI pakai `claimWithSig(user, roundId, amount, nonce, deadline, relayerSig)`.
 * - Kontrak TIDAK menyimpan snapshot/allowlist di on‑chain. Hanya cek tanda tangan relayer (ROLE) + pool & replay guard.
 *
 * Fitur:
 * - Skim pattern (accountedBalance) untuk dana masuk.
 * - Round pool opsional: MANAGER bisa `startRound()` untuk mengunci saldo jadi pool per ronde (mis. per halving),
 *   atau biarkan tanpa round pool (langsung debet dari accountedBalance) — di sini kita sediakan MODE ROUND agar rapi.
 * - Relayer‑gated EIP‑712, user bayar gas sendiri.
 */

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract LeaderboardAuthVault is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    // Roles
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    IERC20 public immutable token; // BaseTC

    // Skim accounting
    uint256 public accountedBalance;

    // Optional round accounting (per halving)
    uint256 public roundId;      // increment tiap mulai ronde
    uint256 public roundPool;    // saldo terkunci untuk ronde aktif (opsional dipakai)
    bool    public roundActive;  // true setelah startRound sampai endRound

    // Replay guards
    mapping(address => uint256) public nonces;                     // per-user nonce
    mapping(uint256 => mapping(address => bool)) public claimed;   // roundId => user => claimed?

    // EIP-712
    bytes32 private immutable _DOMAIN_SEPARATOR;
    string  public constant EIP712_NAME    = "LeaderboardAuthVault";
    string  public constant EIP712_VERSION = "1";
    // UserAction: user klaim amount tertentu untuk roundId tertentu.
    bytes32 public constant ACTION_TYPEHASH = keccak256("UserAction(address user,uint256 roundId,uint256 amount,uint256 nonce,uint256 deadline)");

    // Events
    event Skimmed(uint256 amount);
    event RoundStarted(uint256 indexed roundId, uint256 poolLocked);
    event RoundEnded(uint256 indexed roundId, uint256 leftoverReturned);
    event Claimed(uint256 indexed roundId, address indexed user, uint256 amount);
    event Rescue(address to, uint256 amount);

    constructor(IERC20 baseTc, address admin) {
        token = baseTc;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MANAGER_ROLE, admin);
        _grantRole(RELAYER_ROLE, admin);

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

    // -------- internal helpers --------
    function _skim() internal returns (uint256 newly) {
        uint256 bal = token.balanceOf(address(this));
        if (bal > accountedBalance) {
            newly = bal - accountedBalance;
            accountedBalance = bal;
            emit Skimmed(newly);
        }
    }

    // -------- admin: optional round control --------
    function startRound() external onlyRole(MANAGER_ROLE) {
        require(!roundActive, "ROUND_ACTIVE");
        _skim();
        uint256 pool = accountedBalance;
        require(pool > 0, "NO_FUNDS");
        roundId += 1;
        roundActive = true;
        roundPool = pool;
        accountedBalance -= pool;
        emit RoundStarted(roundId, pool);
    }

    function endRound() external onlyRole(MANAGER_ROLE) {
        require(roundActive, "NO_ROUND");
        roundActive = false;
        // kembalikan sisa pool ke accountedBalance untuk ronde berikutnya
        uint256 leftover = roundPool;
        if (leftover > 0) {
            accountedBalance += leftover;
            roundPool = 0;
        }
        emit RoundEnded(roundId, leftover);
    }

    // -------- user claim (relayer-gated, user pays gas) --------
    function claimWithSig(
        address user,
        uint256 _roundId,
        uint256 amount,
        uint256 nonce,
        uint256 deadline,
        bytes calldata relayerSig
    ) external nonReentrant {
        require(msg.sender == user, "ONLY_SELF");
        require(block.timestamp <= deadline, "SIG_EXPIRED");
        require(nonce == nonces[user], "BAD_NONCE");
        require(amount > 0, "ZERO_AMT");

        // Jika mode round aktif diinginkan, pastikan roundId cocok.
        if (roundActive) {
            require(_roundId == roundId, "BAD_ROUND");
            require(!claimed[_roundId][user], "CLAIMED");
        }

        // verify relayer signature
        bytes32 structHash = keccak256(abi.encode(
            ACTION_TYPEHASH,
            user,
            _roundId,
            amount,
            nonce,
            deadline
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _DOMAIN_SEPARATOR, structHash));
        address signer = ECDSA.recover(digest, relayerSig);
        require(hasRole(RELAYER_ROLE, signer), "BAD_RELAYER_SIG");

        // bookkeep
        nonces[user]++;
        if (roundActive) {
            claimed[_roundId][user] = true;
            require(amount <= roundPool, "POOL_EMPTY");
            roundPool -= amount;
        } else {
            // tanpa round, ambil dari accountedBalance langsung
            _skim();
            require(amount <= accountedBalance, "INSUFFICIENT");
            accountedBalance -= amount;
        }

        token.safeTransfer(user, amount);
        emit Claimed(_roundId, user, amount);
    }

    // -------- admin rescue --------
    function rescue(address to, uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(amount <= accountedBalance, "EXCEEDS");
        accountedBalance -= amount;
        token.safeTransfer(to, amount);
        emit Rescue(to, amount);
    }
}

