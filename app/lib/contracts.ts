import { getContract, type PublicClient, type WalletClient } from "viem";
import { CFG } from "./web3Config";

export function makeContracts(client: PublicClient | WalletClient) {
  return {
    gameCore: getContract({
      address: CFG.addresses.GAMECORE as `0x${string}`,
      abi: CFG.abis.gameCore as any,
      client,
    }),
    rigNft: getContract({
      address: CFG.addresses.RIGNFT as `0x${string}`,
      abi: CFG.abis.rigNft as any,
      client,
    }),
    rigSale: getContract({
      address: CFG.addresses.RIGSALE as `0x${string}`,
      abi: CFG.abis.rigSale as any,
      client,
    }),
    rewards: getContract({
      address: CFG.addresses.REWARDS_VAULT as `0x${string}`,
      abi: CFG.abis.rewardsVault as any,
      client,
    }),
    treasury: getContract({
      address: CFG.addresses.TREASURY as `0x${string}`,
      abi: CFG.abis.treasuryVault as any,
      client,
    }),
    baseTc: getContract({
      address: CFG.addresses.BASETC as `0x${string}`,
      abi: CFG.abis.baseTc as any,
      client,
    }),
    referral: getContract({
      address: CFG.addresses.REFERRAL as `0x${string}`,
      abi: CFG.abis.referral as any,
      client,
    }),
  };
}

