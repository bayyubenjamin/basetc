// app/lib/web3Config.ts
import { ADDR, CHAIN } from "./addresses";

// Pastikan tsconfig: "resolveJsonModule": true
import baseTcABI         from "./abi/baseTc.json";
import rigNftABI         from "./abi/rigNft.json";
import rigSaleABI        from "./abi/rigSale.json";      // ← ABI kontrak RigSaleFlexible final (FID)
import gameCoreABI       from "./abi/gameCore.json";
import rewardsVaultABI   from "./abi/rewardsVault.json";
import treasuryVaultABI  from "./abi/treasuryVault.json";
import referralABI       from "./abi/referralClaimer.json";

// RPC & Chain
export const rpcUrl  = CHAIN.rpcUrl;
export const chainId = CHAIN.id;

// Addresses (named) — diambil dari addresses.ts (sudah kamu set di situ)
export const baseTcAddress        = ADDR.BASETC as `0x${string}`;
export const rigNftAddress        = ADDR.RIGNFT as `0x${string}`;
export const rigSaleAddress       = ADDR.RIGSALE as `0x${string}`;    // ← 0x6DAb... (dari addresses.ts)
export const gameCoreAddress      = ADDR.GAMECORE as `0x${string}`;
export const rewardsVaultAddress  = ADDR.REWARDS_VAULT as `0x${string}`;
export const treasuryVaultAddress = ADDR.TREASURY as `0x${string}`;
export const referralAddress      = ADDR.REFERRAL as `0x${string}`;
export const usdcAddress          = ADDR.USDC as `0x${string}`;

// ABIs (named exports)
export {
  baseTcABI,
  rigNftABI,
  rigSaleABI,         // ← digunakan Market & komponen lain
  gameCoreABI,
  rewardsVaultABI,
  treasuryVaultABI,
  referralABI,
};

// (opsional) satu objek config
export const CFG = {
  chainId,
  rpcUrl,
  addresses: ADDR,
  abis: {
    baseTc: baseTcABI,
    rigNft: rigNftABI,
    rigSale: rigSaleABI,
    gameCore: gameCoreABI,
    rewardsVault: rewardsVaultABI,
    treasuryVault: treasuryVaultABI,
    referral: referralABI,
  },
} as const;

