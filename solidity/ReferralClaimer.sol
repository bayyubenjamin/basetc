// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @dev Minimal interface sesuai RigNFT live:
 *  - mintBySale(address to, uint256 id, uint256 amount)
 *  - BASIC() -> uint256
 */
interface IRigNFT_Referral {
    function BASIC() external view returns (uint256);
    function mintBySale(address to, uint256 id, uint256 amount) external;
}

/// @title ReferralClaimer — klaim 1 BASIC NFT via relayer (anti tuyul + anti double-claim)
/// @notice Hanya RELAYER yang boleh memanggil. Cegah double-claim per FID dan per alamat.
contract ReferralClaimer is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");
    bytes32 public constant PAUSER_ROLE  = keccak256("PAUSER_ROLE");

    IRigNFT_Referral public immutable rig;
    uint256 public immutable BASIC;

    // anti double-claim
    mapping(uint256 => bool) public fidClaimed;     // FID -> claimed?
    mapping(address => bool) public addressClaimed; // wallet -> claimed?

    event Claimed(address indexed user, uint256 indexed fid);

    constructor(address rigNFT) {
        require(rigNFT != address(0), "bad rig");
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);

        rig   = IRigNFT_Referral(rigNFT);
        BASIC = IRigNFT_Referral(rigNFT).BASIC();
    }

    /// @notice Klaim 1 BASIC untuk `user` yang lolos referral, ditrigger oleh relayer (mini-app backend).
    /// @param user alamat penerima NFT
    /// @param fid  identifier unik user dari sistem (mis. Farcaster FID) untuk mencegah double-claim lintas wallet
    function claimBasic(address user, uint256 fid)
        external
        whenNotPaused
        onlyRole(RELAYER_ROLE)
        nonReentrant
    {
        require(user != address(0), "bad user");
        require(!fidClaimed[fid], "fid already claimed");
        require(!addressClaimed[user], "address already claimed");

        // mint 1 BASIC via jalur SALE (aman karena kita enforce id = BASIC)
        rig.mintBySale(user, BASIC, 1);

        fidClaimed[fid]       = true;
        addressClaimed[user]  = true;

        emit Claimed(user, fid);
    }

    // -------- Admin QoL --------
    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

    /// @dev emergency unflag kalau ada kasus khusus (sangat jarang digunakan).
    function adminUnflag(address user, uint256 fid)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        addressClaimed[user] = false;
        fidClaimed[fid] = false;
    }
}

