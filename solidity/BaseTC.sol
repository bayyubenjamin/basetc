// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";

contract BaseTC is ERC20, ERC20Permit, Ownable {
    using Address for address payable;

    uint256 public constant TOTAL_SUPPLY = 21_000_000 * 1e18;

    constructor()
        ERC20("BaseTC", "BASETC")
        ERC20Permit("BaseTC")
        Ownable(msg.sender)
    {
        _mint(msg.sender, TOTAL_SUPPLY);
    }

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

