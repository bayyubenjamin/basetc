// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

interface IGameCoreHook {
    function onRigBalanceWillChange(address user) external;
}

contract RigNFT is ERC1155, ERC1155Supply, AccessControl, Pausable {
    using Strings for uint256;

    // --- Token Tiers ---
    uint256 public constant BASIC  = 1;
    uint256 public constant PRO    = 2;
    uint256 public constant LEGEND = 3;

    // --- Roles ---
    bytes32 public constant SALE_MINTER_ROLE = keccak256("SALE_MINTER_ROLE");
    bytes32 public constant GAME_MINTER_ROLE = keccak256("GAME_MINTER_ROLE");
    bytes32 public constant BURNER_ROLE      = keccak256("BURNER_ROLE");
    bytes32 public constant PAUSER_ROLE      = keccak256("PAUSER_ROLE");

    // --- Supply Caps for Legend Tier ---
    uint256 public constant LEGEND_TOTAL_CAP = 3000;
    uint256 public constant LEGEND_SALE_CAP  = 1500;
    uint256 public constant LEGEND_GAME_CAP  = 1500;

    // --- NEW: Per-user holding cap for LEGEND ---
    uint256 public constant LEGEND_MAX_PER_USER = 3;

    uint256 public legendSaleMinted;
    uint256 public legendGameMinted;

    // --- Metadata (Pinata URLs) ---
    string private basicImageURI;
    string private proImageURI;
    string private legendImageURI;

    // --- GameCore Hook ---
    address public gameCore;
    event GameCoreSet(address indexed gameCore);

    // Event mint
    event RigMinted(address indexed to, uint256 indexed tierId, uint256 amount, string tierName);

    constructor() ERC1155("") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);

        basicImageURI  = "https://amethyst-elegant-spider-17.mypinata.cloud/ipfs/bafkreiewdqrirz76f2a7vcesiobufbvvjc4okjcagdzrmqq5l2f2d7kneq";
        proImageURI    = "https://amethyst-elegant-spider-17.mypinata.cloud/ipfs/bafkreibt6czouhp4uxmh6zn3ggy44x4gytssjw3m4jyhn5k4mvhuabptdq";
        legendImageURI = "https://amethyst-elegant-spider-17.mypinata.cloud/ipfs/bafkreib74sdvzq7uiw7kg5ljizr4hanrj34enyzkyvbrloozwxafz2mowu";
    }

    // ---------- Admin ----------
    function setImageURIs(
        string calldata newBasicURI,
        string calldata newProURI,
        string calldata newLegendURI
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        basicImageURI  = newBasicURI;
        proImageURI    = newProURI;
        legendImageURI = newLegendURI;
    }

    function setGameCore(address _gameCore) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_gameCore != address(0), "ZERO_ADDR");
        gameCore = _gameCore;
        emit GameCoreSet(_gameCore);
    }

    function pause() external onlyRole(PAUSER_ROLE) { _pause(); }
    function unpause() external onlyRole(PAUSER_ROLE) { _unpause(); }

    // ---------- Minting ----------
    function mintBySale(address to, uint256 id, uint256 amount) external onlyRole(SALE_MINTER_ROLE) {
        if (id == LEGEND) {
            // Global caps
            require(legendSaleMinted + amount <= LEGEND_SALE_CAP, "LEGEND sale cap exceeded");
            require(totalSupply(LEGEND) + amount <= LEGEND_TOTAL_CAP, "LEGEND total cap exceeded");
            // Per-user holding cap
            require(balanceOf(to, LEGEND) + amount <= LEGEND_MAX_PER_USER, "LEGEND_MAX_PER_USER_3");
            legendSaleMinted += amount;
        }
        _mint(to, id, amount, "");
        emit RigMinted(to, id, amount, _getTierNameById(id));
    }

    function mintByGame(address to, uint256 id, uint256 amount) external onlyRole(GAME_MINTER_ROLE) {
        if (id == LEGEND) {
            // Global caps
            require(legendGameMinted + amount <= LEGEND_GAME_CAP, "LEGEND game cap exceeded");
            require(totalSupply(LEGEND) + amount <= LEGEND_TOTAL_CAP, "LEGEND total cap exceeded");
            // Per-user holding cap
            require(balanceOf(to, LEGEND) + amount <= LEGEND_MAX_PER_USER, "LEGEND_MAX_PER_USER_3");
            legendGameMinted += amount;
        }
        _mint(to, id, amount, "");
        emit RigMinted(to, id, amount, _getTierNameById(id));
    }

    // ---------- Burn ----------
    function burnFrom(address account, uint256 id, uint256 amount) external onlyRole(BURNER_ROLE) {
        _burn(account, id, amount);
    }

    // ---------- Metadata ----------
    function uri(uint256 id) public view override returns (string memory) {
        (string memory tier, string memory image) = _meta(id);
        bytes memory json = abi.encodePacked(
            '{"name":"BaseTC Rig - ', tier, '",',
            '"description":"Mining rig NFT for BaseTC game.",',
            '"image":"', image, '",',
            '"attributes":[{"trait_type":"Tier","value":"', tier, '"}]}'
        );
        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(json)));
    }

    function _meta(uint256 id) internal view returns (string memory tier, string memory image) {
        if (id == BASIC)  return ("BASIC",  basicImageURI);
        if (id == PRO)    return ("PRO",    proImageURI);
        if (id == LEGEND) return ("LEGEND", legendImageURI);
        revert("URIQueryForNonexistentToken");
    }

    function _getTierNameById(uint256 id) internal pure returns (string memory) {
        if (id == BASIC) return "BASIC";
        if (id == PRO) return "PRO";
        if (id == LEGEND) return "LEGEND";
        return "UNKNOWN";
    }

    // ---------- Hooks ----------
    // OZ v5 pattern: _update dipanggil untuk mint/burn/transfer
    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts
    )
        internal
        override(ERC1155, ERC1155Supply)
        whenNotPaused
    {
        // === Per-user LEGEND cap check (on receiver) ===
        if (to != address(0)) {
            uint256 incomingLegend;
            for (uint256 i = 0; i < ids.length; i++) {
                if (ids[i] == LEGEND) {
                    incomingLegend += amounts[i];
                }
            }
            if (incomingLegend > 0) {
                uint256 newBal = balanceOf(to, LEGEND) + incomingLegend;
                require(newBal <= LEGEND_MAX_PER_USER, "LEGEND_MAX_PER_USER_3");
            }
        }

        // === Call GameCore hook BEFORE balance changes (only if it won't revert by cap) ===
        if (gameCore != address(0) && from != to) {
            if (from != address(0)) {
                IGameCoreHook(gameCore).onRigBalanceWillChange(from);
            }
            if (to != address(0)) {
                IGameCoreHook(gameCore).onRigBalanceWillChange(to);
            }
        }

        super._update(from, to, ids, amounts);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}

