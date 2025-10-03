// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IRigNFT {
    function balanceOf(address account, uint256 id) external view returns (uint256);
}

interface IRigSale {
    function inviteCountOf(address inviter) external view returns (uint256);
}

contract SpinVault is AccessControl, ReentrancyGuard, EIP712 {
    using ECDSA for bytes32;

    bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");

    IERC20 public immutable token;    // BaseTC
    IRigNFT public rigNFT;            // RigNFT contract
    IRigSale public rigSale;          // RigSale contract

    uint256 public epochLength = 1 days;
    uint256 public genesis;

    mapping(uint256 => mapping(address => bool)) public claimed;  // daily claim
    mapping(address => uint256) public usedTickets;               // referral tickets used
    mapping(address => uint256) public nonces;

    struct Range { uint128 minAmt; uint128 maxAmt; }

    Range public basicRange;
    Range public proRange;
    Range public legendRange;
    Range public supremeRange;

    event ClaimedSpin(address indexed user, uint256 epoch, uint256 amount, uint8 tier);

    constructor(IERC20 _token, address admin)
        EIP712("SpinVault", "1")
    {
        token = _token;
        genesis = block.timestamp;

        // --- Default ranges (18 decimals) ---
        basicRange   = Range(uint128(1e14),  uint128(1e15));   // 0.0001 – 0.001
        proRange     = Range(uint128(1e16),  uint128(1e17));   // 0.01 – 0.1
        legendRange  = Range(uint128(1e17),  uint128(1e18));   // 0.1 – 1
        supremeRange = Range(uint128(1e18),  uint128(5e18));   // 1 – 5

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // ----------- Admin ------------
    function setRigNFT(address _rigNFT) external onlyRole(DEFAULT_ADMIN_ROLE) {
        rigNFT = IRigNFT(_rigNFT);
    }

    function setRigSale(address _rigSale) external onlyRole(DEFAULT_ADMIN_ROLE) {
        rigSale = IRigSale(_rigSale);
    }

    function setEpochLength(uint256 len) external onlyRole(DEFAULT_ADMIN_ROLE) {
        epochLength = len;
    }

    function setRanges(
        Range calldata b,
        Range calldata p,
        Range calldata l,
        Range calldata s
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        basicRange = b;
        proRange = p;
        legendRange = l;
        supremeRange = s;
    }

    // ----------- Core ------------
    function epochNow() public view returns (uint256) {
        return (block.timestamp - genesis) / epochLength;
    }

    function availableTickets(address user) public view returns (uint256) {
        if (address(rigSale) == address(0)) return 0;
        uint256 invites = rigSale.inviteCountOf(user);
        if (invites <= usedTickets[user]) return 0;
        return invites - usedTickets[user];
    }

    function _random(uint256 salt) internal view returns (uint256) {
        return uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, salt, blockhash(block.number - 1))));
    }

    function _rangeReward(Range memory r, uint256 count, uint256 salt) internal view returns (uint256) {
        if (count == 0 || r.maxAmt == 0) return 0;
        uint256 min = uint256(r.minAmt) * count;
        uint256 max = uint256(r.maxAmt) * count;
        if (max <= min) return min;
        return min + (_random(salt) % (max - min));
    }

    function pendingReward(address user) public view returns (uint256) {
        uint256 total;
        total += _rangeReward(basicRange, rigNFT.balanceOf(user, 1), 1);
        total += _rangeReward(proRange, rigNFT.balanceOf(user, 2), 2);
        total += _rangeReward(legendRange, rigNFT.balanceOf(user, 3), 3);
        total += _rangeReward(supremeRange, rigNFT.balanceOf(user, 4), 4);
        return total;
    }

    // ----------- Claim ------------
    function claimWithSig(
        address user,
        uint256 nonce,
        uint256 deadline,
        bytes calldata sig
    ) external nonReentrant {
        require(block.timestamp <= deadline, "EXPIRED");
        require(nonce == nonces[user]++, "BAD_NONCE");

        // verify signature
        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(
                keccak256("Spin(address user,uint256 nonce,uint256 deadline)"),
                user,
                nonce,
                deadline
            ))
        );
        address signer = ECDSA.recover(digest, sig);
        require(hasRole(SIGNER_ROLE, signer), "BAD_SIG");

        uint256 epoch = epochNow();
        if (claimed[epoch][user]) {
            // sudah klaim daily, gunakan tiket referral
            require(availableTickets(user) > 0, "NO_TICKET");
            usedTickets[user] += 1;
        } else {
            claimed[epoch][user] = true;
        }

        uint256 reward = pendingReward(user);
        require(reward > 0, "NO_RIG");

        token.transfer(user, reward);

        emit ClaimedSpin(user, epoch, reward, 0);
    }
}

