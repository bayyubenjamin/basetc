// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

interface IRigNFT {
    // Fungsi Minting RigNFT yang dipanggil dari RigSale
    function mintBySale(address to, uint256 id, uint256 amount) external; 
}

/**
 * @title RigSaleFlexible (Free mint via FID + inviter)
 * @notice
 * - Menambahkan peran rewardMinter untuk Mint NFT reward dari kuota undangan.
 */
contract RigSaleFlexible is Ownable, Pausable, ReentrancyGuard, EIP712 {
    using ECDSA for bytes32;

    IRigNFT public immutable rigNFT;
    address public treasury;

    /// ====== Mode pembayaran ======
    enum Mode { ETH_ONLY, ERC20_ONLY }
    Mode private _mode;
    IERC20 private _payToken; // 0x0 jika mode ETH

    /// ====== Harga per tokenId ======
    mapping(uint256 => uint256) private _ethPrices;   // WEI
    mapping(uint256 => uint256) private _erc20Prices; // smallest unit token aktif

    /// ====== Free Mint Basic (konfigurasi target ID & flag global) ======
    uint256 private _freeMintId;         // tokenId free mint (mis. BASIC)
    bool    private _freeMintOpen;       // ON/OFF free mint FID

    /// ====== Free Mint per FID ======
    address public fidSigner;                        // signer tepercaya (mis. RELAYER_ADDRESS)
    mapping(uint256 => bool) public freeMintedByFid; // FID sudah klaim?

    /// ====== Referral storage (relasi & hitung undangan valid) ======
    mapping(address => address) public inviterOf;     // invitee -> inviter (tetap, set sekali)
    mapping(address => uint256) public inviteCount;   // inviter -> jumlah invite valid (unik) yang sukses klaim

    // ── BARU: Peran Minter Reward
    address public rewardMinter;

    // ── EIP-712 typehash untuk klaim berbasis FID + inviter
    bytes32 private constant FREECLAIM_TYPEHASH =
        keccak256("FreeClaim(uint256 fid,address to,address inviter,uint256 deadline)");

    /// ===== Events =====
    event TreasuryChanged(address indexed newTreasury);
    event ModeChanged(Mode newMode, address indexed payToken);
    event PriceSetETH(uint256 indexed id, uint256 priceWei);
    event PriceSetERC20(uint256 indexed id, uint256 priceTokenUnits);
    event BoughtETH(address indexed buyer, uint256 indexed id, uint256 amount, uint256 paidWei);
    event BoughtERC20(address indexed buyer, uint256 indexed id, uint256 amount, uint256 paid);
    event Withdrawn(address indexed to, uint256 amountWei);
    event FreeMintConfigured(uint256 indexed id, bool open);
    event FreeMinted(address indexed to, uint256 indexed id);
    event FidSignerChanged(address indexed newSigner);
    event Invited(address indexed inviter, address indexed invitee, uint256 indexed fid);
    // ── BARU: Event Minter Reward
    event RewardMinterChanged(address indexed oldMinter, address indexed newMinter);
    event RewardMinted(address indexed to, uint256 indexed id, uint256 amount);


    constructor(address _rigNFT, address _treasury, address initialOwner)
        Ownable(initialOwner)
        EIP712("RigSaleFlexible", "1")
    {
        require(_rigNFT != address(0), "bad rig");
        require(_treasury != address(0), "bad treasury");
        rigNFT = IRigNFT(_rigNFT);
        treasury = _treasury;

        _mode = Mode.ETH_ONLY; 
        _freeMintId = 0;       
        _freeMintOpen = false; 
    }

    // ======================
    // Admin
    // ======================
    
    // ── BARU: Admin Minter Reward
    function setRewardMinter(address minter) external onlyOwner {
        require(minter != address(0), "bad minter");
        emit RewardMinterChanged(rewardMinter, minter);
        rewardMinter = minter;
    }
    // ── AKHIR BARU

    function setTreasury(address t) external onlyOwner {
        require(t != address(0), "bad treasury");
        treasury = t;
        emit TreasuryChanged(t);
    }

    function setPaymentModeETH() external onlyOwner {
        _mode = Mode.ETH_ONLY;
        _payToken = IERC20(address(0));
        emit ModeChanged(_mode, address(0));
    }
// ... (Fungsi Admin lainnya seperti setPaymentModeERC20, setEthPrice, dll. tetap sama) ...
    function setPaymentModeERC20(address token) external onlyOwner {
        require(token != address(0), "bad token");
        _payToken = IERC20(token);
        _mode = Mode.ERC20_ONLY;
        emit ModeChanged(_mode, token);
    }

    function setEthPrice(uint256 id, uint256 priceWei) external onlyOwner {
        _ethPrices[id] = priceWei; // 0 = not for sale (ETH)
        emit PriceSetETH(id, priceWei);
    }

    function setErc20Price(uint256 id, uint256 priceTokenUnits) external onlyOwner {
        _erc20Prices[id] = priceTokenUnits; // 0 = not for sale (ERC20)
        emit PriceSetERC20(id, priceTokenUnits);
    }

    function setBatchEthPrices(uint256[] calldata ids, uint256[] calldata pricesWei) external onlyOwner {
        require(ids.length == pricesWei.length, "len mismatch");
        for (uint256 i = 0; i < ids.length; i++) {
            _ethPrices[ids[i]] = pricesWei[i];
            emit PriceSetETH(ids[i], pricesWei[i]);
        }
    }

    function setBatchErc20Prices(uint256[] calldata ids, uint256[] calldata prices) external onlyOwner {
        require(ids.length == prices.length, "len mismatch");
        for (uint256 i = 0; i < ids.length; i++) {
            _erc20Prices[ids[i]] = prices[i];
            emit PriceSetERC20(ids[i], prices[i]);
        }
    }

    /// ====== Free mint controls (target id & flag global untuk FID) ======
    function setFreeMintId(uint256 id) external onlyOwner {
        _freeMintId = id;
        emit FreeMintConfigured(_freeMintId, _freeMintOpen);
    }

    function setFreeMintOpen(bool open) external onlyOwner {
        _freeMintOpen = open;
        emit FreeMintConfigured(_freeMintId, _freeMintOpen);
    }

    /// ====== FID signer ======
    function setFidSigner(address signer) external onlyOwner {
        fidSigner = signer;
        emit FidSignerChanged(signer);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function withdraw(uint256 amountWei) external onlyOwner nonReentrant {
        require(amountWei <= address(this).balance, "insufficient ETH");
        (bool ok, ) = payable(treasury).call{value: amountWei}("");
        require(ok, "withdraw failed");
        emit Withdrawn(treasury, amountWei);
    }

    function withdrawAll() external onlyOwner nonReentrant {
        uint256 bal = address(this).balance;
        (bool ok, ) = payable(treasury).call{value: bal}("");
        require(ok, "withdraw failed");
        emit Withdrawn(treasury, bal);
    }


    // ======================
    // MINTING REWARD BARU (Dipanggil oleh Relayer)
    // ======================

    /**
     * @notice Mint Rig NFT ke pengguna sebagai Reward Undangan.
     * @dev Ini adalah fungsi yang akan dipanggil relayer Anda.
     */
    function mintRewardRig(address to, uint256 id, uint256 amount) external whenNotPaused {
        // HANYA rewardMinter yang dapat memanggil fungsi ini
        require(msg.sender == rewardMinter, "unauthorized minter");
        require(id != 0, "bad id");
        require(amount > 0, "amount=0");

        rigNFT.mintBySale(to, id, amount);

        emit RewardMinted(to, id, amount);
    }

    // ======================
    // View / Getters (untuk frontend)
    // ======================
    // ... (Semua View/Getters tetap sama) ...
    function currentMode() external view returns (Mode) { return _mode; }
    function paymentToken() external view returns (address) { return address(_payToken); }

    function priceOf(uint256 id) external view returns (uint256) {
        return _mode == Mode.ETH_ONLY ? _ethPrices[id] : _erc20Prices[id];
    }
    function priceETHOf(uint256 id) external view returns (uint256) { return _ethPrices[id]; }
    function priceERC20Of(uint256 id) external view returns (uint256) { return _erc20Prices[id]; }
    function isForSale(uint256 id) external view returns (bool) {
        return _mode == Mode.ETH_ONLY ? _ethPrices[id] > 0 : _erc20Prices[id] > 0;
    }

    function freeMintId() external view returns (uint256) { return _freeMintId; }
    function freeMintOpen() external view returns (bool) { return _freeMintOpen; }

    // ===== Referral getters =====
    function inviterOfAddress(address invitee) external view returns (address) {
        return inviterOf[invitee];
    }
    function inviteCountOf(address inviter) external view returns (uint256) {
        return inviteCount[inviter];
    }

    // ======================
    // Free Mint per FID (klaim user)
    // ======================

    function claimFreeByFidSig(
        uint256 fid,
        address to,
        address inviter,
        uint256 deadline,
        uint8 v, bytes32 r, bytes32 s
    ) external whenNotPaused nonReentrant
    {
        require(_freeMintOpen, "free closed");
        require(fidSigner != address(0), "fid signer not set");
        require(!freeMintedByFid[fid], "FID claimed");
        require(block.timestamp <= deadline, "expired");

        bytes32 structHash = keccak256(abi.encode(
            FREECLAIM_TYPEHASH, fid, to, inviter, deadline
        ));
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, v, r, s);
        require(signer == fidSigner, "bad signer");

        uint256 id = _freeMintId;
        require(id != 0, "free id not set");

        freeMintedByFid[fid] = true;
        rigNFT.mintBySale(to, id, 1); // <--- INI ADALAH CLAIM GRATIS USER, BUKAN REWARD
        emit FreeMinted(to, id);

        if (inviter != address(0) && inviter != to && inviterOf[to] == address(0)) {
            inviterOf[to] = inviter;
            unchecked { inviteCount[inviter] += 1; }
            emit Invited(inviter, to, fid);
        }
    }

    // ======================
    // User Buying (bayar)
    // ======================
    // ... (Fungsi buy, buyWithETH, buyWithERC20, dan Internal helpers _buyETH, _buyERC20 tetap sama) ...
    function buy(uint256 id, uint256 amount) external payable whenNotPaused nonReentrant {
        if (_mode == Mode.ETH_ONLY) {
            _buyETH(id, amount);
        } else {
            _buyERC20(id, amount);
        }
    }

    function buyWithETH(uint256 id, uint256 amount) external payable whenNotPaused nonReentrant {
        require(_mode == Mode.ETH_ONLY, "ETH disabled");
        _buyETH(id, amount);
    }

    function buyWithERC20(uint256 id, uint256 amount) external whenNotPaused nonReentrant {
        require(_mode == Mode.ERC20_ONLY, "ERC20 disabled");
        _buyERC20(id, amount);
    }

    // ---------- Internal helpers ----------

    function _buyETH(uint256 id, uint256 amount) internal {
        require(amount > 0, "amount=0");
        uint256 price = _ethPrices[id];
        require(price > 0, "not for sale (ETH)");
        uint256 cost = price * amount;
        require(msg.value >= cost, "insufficient ETH");

        rigNFT.mintBySale(msg.sender, id, amount);

        uint256 refund = msg.value - cost;

        (bool ok, ) = payable(treasury).call{value: cost}("");
        require(ok, "forward failed");

        if (refund > 0) {
            (ok, ) = payable(msg.sender).call{value: refund}("");
            require(ok, "refund failed");
        }

        emit BoughtETH(msg.sender, id, amount, cost);
    }

    function _buyERC20(uint256 id, uint256 amount) internal {
        require(address(_payToken) != address(0), "token not set");
        require(amount > 0, "amount=0");

        uint256 price = _erc20Prices[id];
        require(price > 0, "not for sale (ERC20)");

        uint256 cost = price * amount;

        require(_payToken.allowance(msg.sender, address(this)) >= cost, "allowance low");
        require(_payToken.transferFrom(msg.sender, treasury, cost), "transfer failed");

        rigNFT.mintBySale(msg.sender, id, amount);

        emit BoughtERC20(msg.sender, id, amount, cost);
    }

    receive() external payable {}
}

