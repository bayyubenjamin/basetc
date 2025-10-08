// app/lib/web3Config.ts
import { http, createConfig } from "wagmi";
import { base } from "wagmi/chains"; 
import farcaster from "@farcaster/miniapp-wagmi-connector";

// ABIs
import baseTcABI from "./abi/baseTc.json";
import rigNftABI from "./abi/rigNft.json";
import rigSaleABI from "./abi/rigSale.json";
import gameCoreABI from "./abi/gameCore.json";
import rewardsVaultABI from "./abi/rewardsVault.json";
import treasuryVaultABI from "./abi/treasuryVault.json";
import referralABI from "./abi/referralClaimer.json";
import stakingVaultABI from "./abi/stakingVault.json"; // <-- ABI Baru
import spinVaultABI from "./abi/spinVault.json"; // <-- ABI Baru
import leaderboardAuthVaultABI from "./abi/leaderboardAuthVault.json"; // <-- ABI Baru

// Alamat kontrak
export const ADDR = {
  BASETC:        "0xb06c23DadcB592efC843ad8eD6B294098A5813EE",
  RIGNFT:        "0xC3526e50924768aA2B4c1A8F16626E4fceb5EFed",
  GAMECORE:      "0xA87687f4252e32767528bfd65489852bD061b8F8",
  REWARDS_VAULT: "0x8f75cB6135F106C45f2B7B8841ecA92dD25e47B5",
  RIGSALE:       "0x6704C82dbE849707fdE78123A000f019054F387D",
  TREASURY:      "0x8eC2Ca3fdea29C1658c7ecF8b8dCE7EC09Fa7E55",
  USDC:          "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  REFERRAL:      "0x7aEc439c8cFd1eF09F3C57B19CC4ACF5Ad103Df2",

  // for event
  LEADERBOARD:   "0xb962EB2C83982D78878d02fF4226718338877b91",
  SPIN_VAULT:    "0x0732aBbB38E6f1bB307F9DE42d094f65b1a416d1",
  STAKING_VAULT: "0x4bD10FB51609D064DE96BBa8411b4e5452014752",
} as const;

// Konfigurasi Chain untuk Base Mainnet
export const CHAIN = {
  id: 8453, // Chain ID Base Mainnet
  rpcUrl: "https://mainnet.base.org", // RPC URL Base Mainnet
} as const;

export const {
    BASETC: baseTcAddress,
    RIGNFT: rigNftAddress,
    GAMECORE: gameCoreAddress,
    REWARDS_VAULT: rewardsVaultAddress,
    RIGSALE: rigSaleAddress,
    TREASURY: treasuryVaultAddress,
    USDC: usdcAddress,
    REFERRAL: referralAddress,
    LEADERBOARD: leaderboardAddress,
    SPIN_VAULT: spinVaultAddress,
    STAKING_VAULT: stakingVaultAddress,
} = ADDR;

export {
  baseTcABI, rigNftABI, rigSaleABI, gameCoreABI,
  rewardsVaultABI, treasuryVaultABI, referralABI,
  stakingVaultABI, spinVaultABI, leaderboardAuthVaultABI
};

export const config = createConfig({
  chains: [base], // Ganti ke `base`
  connectors: [farcaster()],
  transports: {
    [base.id]: http(), // Ganti ke `base.id`
  },
});

export const chainId = CHAIN.id;
export const BASE_CHAIN_ID = CHAIN.id;

export const CFG = {
    ...CHAIN,
    addresses: ADDR,
    abis: {
        baseTc: baseTcABI,
        rigNft: rigNftABI,
        rigSale: rigSaleABI,
        gameCore: gameCoreABI,
        rewardsVault: rewardsVaultABI,
        treasuryVault: treasuryVaultABI,
        referral: referralABI,
        stakingVault: stakingVaultABI,
        spinVault: spinVaultABI,
        leaderboardAuthVault: leaderboardAuthVaultABI,
    }
};
