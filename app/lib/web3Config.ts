import gameCoreABI       from "./abi/gameCore.json";
import rigNftABI         from "./abi/rigNft.json";
import rigSaleABI        from "./abi/rigSale.json";
import rewardsVaultABI   from "./abi/rewardsVault.json";
import treasuryVaultABI  from "./abi/treasuryVault.json";
import baseTcABI         from "./abi/baseTc.json";
import referralABI       from "./abi/referralClaimer.json";
import { ADDR, CHAIN }   from "./addresses";

export const CFG = {
  CHAIN,
  ADDR,
  ABI: {
    gameCore: gameCoreABI,
    rigNft: rigNftABI,
    rigSale: rigSaleABI,
    rewardsVault: rewardsVaultABI,
    treasuryVault: treasuryVaultABI,
    baseTc: baseTcABI,
    referral: referralABI,
  },
} as const;

