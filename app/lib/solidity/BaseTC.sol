// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";

/**
 * ERC20 + Permit + on-chain URI (logoURI & tokenURI/EIP-1046 style).
 * Catatan: wallet/explorer sering ambil logo dari off-chain (explorer, tokenlist).
 * URI on-chain ini sebagai pelengkap/standar rapi.
 */
contract BaseTC is ERC20, ERC20Permit, Ownable {
    using Address for address payable;

    uint256 public constant TOTAL_SUPPLY = 21_000_000 * 1e18;

    // --- On-chain URI (tambahan, tidak ganggu fungsi lain) ---
    // Contoh: ipfs://.../basetc-256.png
    string private _logoURI;
    // Contoh: ipfs://.../basetc.json (metadata: name, symbol, decimals, image, website)
    string private _metadataURI;

    event LogoURIUpdated(string newURI);
    event MetadataURIUpdated(string newURI);

    constructor()
        ERC20("BaseTC", "BASETC")
        ERC20Permit("BaseTC")
        Ownable(msg.sender)
    {
        _mint(msg.sender, TOTAL_SUPPLY);
        // (Opsional) preset:
        // _logoURI = "ipfs://.../basetc-256.png";
        // _metadataURI = "ipfs://.../basetc.json";
    }

    // --- Getters (URI) ---
    function logoURI() external view returns (string memory) {
        return _logoURI;
    }

    // Gaya EIP-1046: metadata JSON untuk ERC-20
    function tokenURI() external view returns (string memory) {
        return _metadataURI;
    }

    // --- Setters (owner only) ---
    function setLogoURI(string calldata newURI) external onlyOwner {
        _logoURI = newURI;
        emit LogoURIUpdated(newURI);
    }

    function setMetadataURI(string calldata newURI) external onlyOwner {
        _metadataURI = newURI;
        emit MetadataURIUpdated(newURI);
    }

    // --- Rescue utilities (ASLI dari punyamu; tidak dihapus) ---
    function rescueERC20(address token, address to, uint256 amount) external onlyOwner {
        require(token != address(this), "BASETC: cannot rescue self");
        require(to != address(0), "BASETC: bad to");
        require(IERC20(token).transfer(to, amount), "transfer failed");
    }

    function rescueETH(address payable to, uint256 amount) external onlyOwner {
        require(to != address(0), "BASETC: bad to");
        to.sendValue(amount);
    }
}

