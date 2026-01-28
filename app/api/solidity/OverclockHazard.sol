// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Interface untuk membaca saldo NFT
interface IRigNFT {
    function balanceOf(address account, uint256 id) external view returns (uint256);
}

contract OverclockHazard is AccessControl, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    IERC20 public immutable token;   // BaseTC Token
    IRigNFT public immutable rigNFT; // RigNFT Contract

    address public treasury;
    uint256 public feeBps = 500; // 5% fee saat cashout

    // --- GAME CONFIG ---
    // Level 1: 90% Success | 1.2x Multiplier
    // Level 2: 70% Success | 1.8x Multiplier
    // Level 3: 50% Success | 3.5x Multiplier
    // Level 4: 30% Success | 8.0x Multiplier
    
    uint256[] public baseSuccessRates = [90, 70, 50, 30]; 
    uint256[] public multipliers = [120, 180, 350, 800]; // Dibagi 100 (120 = 1.2x)

    struct GameSession {
        uint256 betAmount;
        uint8 currentLevel; // 0 = Belum main, 1 = Level 1, dst
        bool active;
    }

    mapping(address => GameSession) public sessions;

    event GameStarted(address indexed player, uint256 amount);
    event OverclockSuccess(address indexed player, uint8 newLevel, uint256 currentMultiplier);
    event OverclockFailed(address indexed player, uint8 levelFailed);
    event CashedOut(address indexed player, uint256 prize, uint256 fee);

    constructor(address _token, address _rigNFT, address _treasury) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        
        token = IERC20(_token);
        rigNFT = IRigNFT(_rigNFT);
        treasury = _treasury;
    }

    // 1. Mulai Game (Taruh Taruhan)
    function startGame(uint256 amount) external nonReentrant {
        require(amount > 0, "Bet > 0");
        require(!sessions[msg.sender].active, "Finish active game first");

        // Tarik Token dari User
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        sessions[msg.sender] = GameSession({
            betAmount: amount,
            currentLevel: 0, // Level 0 artinya baru mulai (belum di-boost)
            active: true
        });

        emit GameStarted(msg.sender, amount);
    }

    // 2. Overclock (Push Your Luck)
    function overclock() external nonReentrant {
        GameSession storage s = sessions[msg.sender];
        require(s.active, "No active game");
        require(s.currentLevel < 4, "Max level reached");

        // Hitung Peluang Menang
        uint256 successChance = baseSuccessRates[s.currentLevel]; // Ambil chance level saat ini
        uint256 nftBoost = _calculateBoost(msg.sender);
        uint256 totalChance = successChance + nftBoost;
        if (totalChance > 95) totalChance = 95; // Cap chance di 95% biar tetap ada risiko

        // RNG Logic (Simple)
        uint256 rng = uint256(keccak256(abi.encodePacked(block.timestamp, block.prevrandao, msg.sender))) % 100;

        if (rng < totalChance) {
            // SUKSES
            s.currentLevel++;
            emit OverclockSuccess(msg.sender, s.currentLevel, multipliers[s.currentLevel - 1]);
        } else {
            // GAGAL (MELEDAK)
            uint256 lostAmount = s.betAmount;
            delete sessions[msg.sender]; // Hapus sesi
            
            // Opsional: Kirim sebagian kecil ke treasury saat kalah, sisanya burn/stay contract
            if (treasury != address(0)) {
                token.transfer(treasury, lostAmount / 2); // 50% masuk treasury saat kalah
            }
            
            emit OverclockFailed(msg.sender, s.currentLevel + 1);
        }
    }

    // 3. Cashout (Ambil Untung)
    function cashout() external nonReentrant {
        GameSession storage s = sessions[msg.sender];
        require(s.active, "No active game");
        require(s.currentLevel > 0, "Cannot cashout at level 0");

        uint256 multiplier = multipliers[s.currentLevel - 1];
        uint256 totalWin = (s.betAmount * multiplier) / 100;

        uint256 fee = (totalWin * feeBps) / 10000;
        uint256 prize = totalWin - fee;

        delete sessions[msg.sender]; // Hapus sesi sebelum transfer (CEI Pattern)

        token.transfer(msg.sender, prize);
        if (fee > 0 && treasury != address(0)) {
            token.transfer(treasury, fee);
        }

        emit CashedOut(msg.sender, prize, fee);
    }

    // Helper: Hitung Boost dari NFT
    function _calculateBoost(address user) public view returns (uint256) {
        // Basic (ID 1): +1% per kartu (Max 3%)
        // Pro (ID 2): +3% per kartu (Max 9%)
        // Legend (ID 3): +10% per kartu (Max 20%)
        
        uint256 b = rigNFT.balanceOf(user, 1);
        uint256 p = rigNFT.balanceOf(user, 2);
        uint256 l = rigNFT.balanceOf(user, 3);

        if (b > 3) b = 3;
        if (p > 3) p = 3;
        if (l > 2) l = 2;

        return (b * 1) + (p * 3) + (l * 10);
    }
    
    // Admin functions
    function setFee(uint256 _feeBps) external onlyRole(ADMIN_ROLE) {
        feeBps = _feeBps;
    }
}
