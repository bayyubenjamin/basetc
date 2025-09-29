// app/lib/web3Config.ts
//
// Alasan Perbaikan Final: Memperbaiki build error "is not exported".
// Menambahkan kembali ekspor `BASE_CHAIN_ID` dan `CFG` yang dibutuhkan oleh
// komponen lain (Monitoring, Rakit, API Routes) yang rusak akibat refactoring sebelumnya.
import { http, createConfig } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import farcaster from "@farcaster/miniapp-wagmi-connector";

// ABIs diimpor dari file JSON
import baseTcABI from "./abi/baseTc.json";
import rigNftABI from "./abi/rigNft.json";
import rigSaleABI from "./abi/rigSale.json";
import gameCoreABI from "./abi/gameCore.json";
import rewardsVaultABI from "./abi/rewardsVault.json";
import treasuryVaultABI from "./abi/treasuryVault.json";
import referralABI from "./abi/referralClaimer.json";

// Alamat kontrak dan detail chain
export const ADDR = {
  BASETC:        "0x6F1d3aEB43beE9337dbeA4574dACC22AE0a0B7FB",
  RIGNFT:        "0x18cb04711f100fC3d108825476c294eaed6EA173",
  GAMECORE:      "0x87Eac0Fbf5e656457bF52ec29c607BB955a58836",
  REWARDS_VAULT: "0x94301D1ad0228b60C9D2C320E99d43A5A45150aC",
  RIGSALE:       "0xe3B591CFECED03A809E6668E5c0f380846d238Cf",
  TREASURY:      "0x8eC2Ca3fdea29C1658c7ecF8b8dCE7EC09Fa7E55",
  USDC:          "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  REFERRAL:      "0x8f75cB6135F106C45f2B7B8841ecA92dD25e47B5",
} as const;

export const CHAIN = {
  id: 84532,
  rpcUrl: "https://sepolia.base.org",
} as const;

// Ekspor alamat dan ABI secara individual
export const {
    BASETC: baseTcAddress,
    RIGNFT: rigNftAddress,
    GAMECORE: gameCoreAddress,
    REWARDS_VAULT: rewardsVaultAddress,
    RIGSALE: rigSaleAddress,
    TREASURY: treasuryVaultAddress,
    USDC: usdcAddress,
    REFERRAL: referralAddress,
} = ADDR;

export {
  baseTcABI, rigNftABI, rigSaleABI, gameCoreABI,
  rewardsVaultABI, treasuryVaultABI, referralABI,
};

// Konfigurasi Wagmi dibuat dan diekspor dari sini
export const config = createConfig({
  chains: [baseSepolia],
  connectors: [farcaster()],
  transports: {
    [baseSepolia.id]: http(),
  },
});

// --- FIX DI SINI ---
// Menambahkan kembali ekspor yang dibutuhkan oleh komponen lain
export const BASE_CHAIN_ID = CHAIN.id;
export const CFG = CHAIN;

