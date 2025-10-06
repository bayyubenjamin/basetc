// app/lib/web3Config.ts
import { http, createConfig } from "wagmi";
import { baseSepolia } from "wagmi/chains";
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
  BASETC:        "0x6F1d3aEB43beE9337dbeA4574dACC22AE0a0B7FB",
  RIGNFT:        "0x18cb04711f100fC3d108825476c294eaed6EA173",
  GAMECORE:      "0x87Eac0Fbf5e656457bF52ec29c607BB955a58836",
  REWARDS_VAULT: "0x94301D1ad0228b60C9D2C320E99d43A5A45150aC",
  RIGSALE:       "0x2e9820e879513a13F1cdb96eaCbc68482A84Bf86",
  TREASURY:      "0x8eC2Ca3fdea29C1658c7ecF8b8dCE7EC09Fa7E55",
  USDC:          "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  REFERRAL:      "0x8f75cB6135F106C45f2B7B8841ecA92dD25e47B5",
  // Alamat Event
  LEADERBOARD:   "0xb962EB2C83982D78878d02fF4226718338877b91",
  SPIN_VAULT:    "0x1965b46FB4F114631994C0Be8D604566bc99A23f",
  STAKING_VAULT: "0x4bD10FB51609D064DE96BBa8411b4e5452014752",
} as const;

export const CHAIN = {
  id: 84532,
  rpcUrl: "https://sepolia.base.org",
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
  chains: [baseSepolia],
  connectors: [farcaster()],
  transports: {
    [baseSepolia.id]: http(),
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
