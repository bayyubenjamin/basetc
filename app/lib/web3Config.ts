// app/lib/web3Config.ts
import { ADDR, CHAIN } from "./addresses";

// JSON ABI imports (butuh resolveJsonModule:true)
import baseTcABI         from "./abi/baseTc.json";
import rigNftABI         from "./abi/rigNft.json";
import rigSaleABI        from "./abi/rigSale.json";
import gameCoreABI       from "./abi/gameCore.json";
import rewardsVaultABI   from "./abi/rewardsVault.json";
import treasuryVaultABI  from "./abi/treasuryVault.json";
import referralABI       from "./abi/referralClaimer.json";

// Named exports yang dipakai komponen
export const rpcUrl = CHAIN.rpcUrl;
export const chainId = CHAIN.id;

// Addresses (named) — match dengan import di komponen
export const baseTcAddress        = ADDR.BASETC;
export const rigNftAddress        = ADDR.RIGNFT;
export const rigSaleAddress       = ADDR.RIGSALE;
export const gameCoreAddress      = ADDR.GAMECORE;
export const rewardsVaultAddress  = ADDR.REWARDS_VAULT;
export const treasuryVaultAddress = ADDR.TREASURY;
export const referralAddress      = ADDR.REFERRAL;
export const usdcAddress          = ADDR.USDC;

// ABIs (named)
export { baseTcABI, rigNftABI, rigSaleABI, gameCoreABI, rewardsVaultABI, treasuryVaultABI, referralABI };

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

