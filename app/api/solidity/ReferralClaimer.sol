// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @dev Interface untuk RigNFT
 */
interface IRigNFT_Referral {
    function BASIC() external view returns (uint256);
    function mintBySale(address to, uint256 id, uint256 amount) external;
}

/// @title ReferralClaimer V2
/// @notice Sistem klaim NFT berbasis FID (Farcaster) dengan proteksi double-claim.
contract ReferralClaimer is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    bytes32 public constant PAUSER_ROLE  = keccak256("PAUSER_ROLE");

    IRigNFT_Referral public immutable rig;
    uint256 public immutable BASIC_ID;

    mapping(uint256 => bool) public fidClaimed;
    mapping(address => bool) public addressClaimed;

    // --- Custom Errors (Gas Efficient) ---
    error AlreadyClaimedByFID(uint256 fid);
    error AlreadyClaimedByAddress(address user);
    error InvalidAddress();
    error MintFailed();

    event Claimed(address indexed user, uint256 indexed fid, uint256 timestamp);
    event Unflagged(address indexed user, uint256 indexed fid);

    constructor(address rigNFT) {
        if (rigNFT == address(0)) revert InvalidAddress();
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        // Otomatis kasih admin role relayer agar deployer bisa lgsg set backend
        _grantRole(RELAYER_ROLE, msg.sender); 

        rig = IRigNFT_Referral(rigNFT);
        BASIC_ID = IRigNFT_Referral(rigNFT).BASIC();
    }

    /**
     * @notice Fungsi utama klaim via Relayer
     * @dev Menambahkan proteksi ganda: 1 FID hanya 1 kali, 1 Wallet hanya 1 kali.
     */
    function claimBasic(address user, uint256 fid)
        external
        whenNotPaused
        onlyRole(RELAYER_ROLE)
        nonReentrant
    {
        if (user == address(0)) revert InvalidAddress();
        if (fidClaimed[fid]) revert AlreadyClaimedByFID(fid);
        if (addressClaimed[user]) revert AlreadyClaimedByAddress(user);

        // Efek sebelum interaksi (Checks-Effects-Interactions pattern)
        fidClaimed[fid] = true;
        addressClaimed[user] = true;

        // Eksekusi Mint
        try rig.mintBySale(user, BASIC_ID, 1) {
            emit Claimed(user, fid, block.timestamp);
        } catch {
            revert MintFailed();
        }
    }

    // --- Admin Functions ---

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @dev Jika ada user yang salah input wallet atau butuh reset claim
     */
    function adminUnflag(address user, uint256 fid)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        addressClaimed[user] = false;
        fidClaimed[fid] = false;
        emit Unflagged(user, fid);
    }
}
