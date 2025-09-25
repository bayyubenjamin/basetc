import { getContract, type PublicClient, type WalletClient } from "viem";
import { CFG } from "./web3Config";

export function makeContracts(client: PublicClient | WalletClient) {
  return {
    gameCore: getContract({ address: CFG.ADDR.GAMECORE, abi: CFG.ABI.gameCore, client }),
    rigNft:   getContract({ address: CFG.ADDR.RIGNFT,   abi: CFG.ABI.rigNft,   client }),
    rigSale:  getContract({ address: CFG.ADDR.RIGSALE,  abi: CFG.ABI.rigSale,  client }),
    rewards:  getContract({ address: CFG.ADDR.REWARDS_VAULT, abi: CFG.ABI.rewardsVault, client }),
    treasury: getContract({ address: CFG.ADDR.TREASURY, abi: CFG.ABI.treasuryVault, client }),
    baseTc:   getContract({ address: CFG.ADDR.BASETC,   abi: CFG.ABI.baseTc,   client }),
    referral: getContract({ address: CFG.ADDR.REFERRAL, abi: CFG.ABI.referral, client }),
  };
}

