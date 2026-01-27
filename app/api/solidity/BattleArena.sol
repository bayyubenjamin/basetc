// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IRigNFT {
    function balanceOf(address account, uint256 id) external view returns (uint256);
}

contract BattleArena is AccessControl, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    IERC20 public immutable token;
    IRigNFT public immutable rig;

    address public treasury;
    uint256 public feeBps = 500; // 5%
    
    // --- PERBAIKAN DI SINI: Langsung set angka, gak perlu tanya kontrak lain ---
    uint256 private constant BASIC = 1;
    uint256 private constant PRO = 2;
    uint256 private constant LEGEND = 3;

    struct Lobby {
        address creator;
        uint256 betAmount;
        bool active;
    }

    uint256 public nextLobbyId = 1;
    mapping(uint256 => Lobby) public lobbies;

    event LobbyCreated(uint256 indexed lobbyId, address indexed creator, uint256 betAmount);
    event BattleFinished(uint256 indexed lobbyId, address indexed winner, address loser, uint256 prize);

    // Constructor jadi JAUH lebih aman
    constructor(address _token, address _rigNFT, address _treasury) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);

        require(_token != address(0), "Token address 0");
        require(_rigNFT != address(0), "Rig address 0");

        token = IERC20(_token);
        rig = IRigNFT(_rigNFT);
        treasury = _treasury;
        
        // Kode yang bikin error (rig.BASIC()) SUDAH DIHAPUS.
    }

    function createLobby(uint256 amount) external nonReentrant {
        require(amount > 0, "Bet must be > 0");
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        lobbies[nextLobbyId] = Lobby({
            creator: msg.sender,
            betAmount: amount,
            active: true
        });

        emit LobbyCreated(nextLobbyId, msg.sender, amount);
        nextLobbyId++;
    }

    function joinLobby(uint256 lobbyId) external nonReentrant {
        Lobby storage l = lobbies[lobbyId];
        require(l.active, "Lobby not active");
        require(msg.sender != l.creator, "Cannot fight self");

        require(token.transferFrom(msg.sender, address(this), l.betAmount), "Transfer failed");

        l.active = false;

        uint256 powerCreator = _calculatePower(l.creator);
        uint256 powerChallenger = _calculatePower(msg.sender);

        address winner = _battleLogic(l.creator, powerCreator, msg.sender, powerChallenger);
        address loser = (winner == l.creator) ? msg.sender : l.creator;

        uint256 totalPot = l.betAmount * 2;
        uint256 fee = (totalPot * feeBps) / 10000;
        uint256 prize = totalPot - fee;

        token.transfer(winner, prize);
        
        if (fee > 0 && treasury != address(0)) {
            token.transfer(treasury, fee);
        }

        emit BattleFinished(lobbyId, winner, loser, prize);
    }

    function cancelLobby(uint256 lobbyId) external nonReentrant {
        Lobby storage l = lobbies[lobbyId];
        require(l.active, "Lobby not active");
        require(msg.sender == l.creator, "Not creator");

        l.active = false;
        token.transfer(msg.sender, l.betAmount);
    }

    function _calculatePower(address user) internal view returns (uint256) {
        // Karena BASIC/PRO/LEGEND sudah konstan 1,2,3, ini aman
        uint256 b = rig.balanceOf(user, BASIC);
        uint256 p = rig.balanceOf(user, PRO);
        uint256 l = rig.balanceOf(user, LEGEND);

        return (b * 1) + (p * 5) + (l * 20) + 10; 
    }

    function _battleLogic(address p1, uint256 pow1, address p2, uint256 pow2) internal view returns (address) {
        uint256 totalPower = pow1 + pow2;
        uint256 random = uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, p1, p2))) % totalPower;
        return (random < pow1) ? p1 : p2;
    }

    function setFee(uint256 _feeBps) external onlyRole(ADMIN_ROLE) {
        feeBps = _feeBps;
    }

    function setTreasury(address _treasury) external onlyRole(ADMIN_ROLE) {
        treasury = _treasury;
    }
}
