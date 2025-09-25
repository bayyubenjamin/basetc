import { getContract, type PublicClient, type WalletClient } from "viem";
import { CFG } from "./web3Config";

// Wrapper helper yang aman untuk berbagai versi viem
function wrapClient(client: PublicClient | WalletClient) {
  const c: any = client as any;
  // Heuristik: WalletClient biasanya punya sendTransaction / request
  if (c?.sendTransaction || c?.request) {
    return { wallet: c };
  }
  return { public: c };
}

export function makeContracts(client: PublicClient | WalletClient) {
  const wrapped = wrapClient(client);

  return {
    gameCore: getContract({
      address: CFG.addresses.GAMECORE as `0x${string}`,
      abi: CFG.abis.gameCore as any,
      // cast ke any supaya union {public|wallet} diterima di semua varian tipe viem
      client: wrapped as any,
    }),
    rigNft: getContract({
      address: CFG.addresses.RIGNFT as `0x${string}`,
      abi: CFG.abis.rigNft as any,
      client: wrapped as any,
    }),
    rigSale: getContract({
      address: CFG.addresses.RIGSALE as `0x${string}`,
      abi: CFG.abis.rigSale as any,
      client: wrapped as any,
    }),
    rewards: getContract({
      address: CFG.addresses.REWARDS_VAULT as `0x${string}`,
      abi: CFG.abis.rewardsVault as any,
      client: wrapped as any,
    }),
    treasury: getContract({
      address: CFG.addresses.TREASURY as `0x${string}`,
      abi: CFG.abis.treasuryVault as any,
      client: wrapped as any,
    }),
    baseTc: getContract({
      address: CFG.addresses.BASETC as `0x${string}`,
      abi: CFG.abis.baseTc as any,
      client: wrapped as any,
    }),
    referral: getContract({
      address: CFG.addresses.REFERRAL as `0x${string}`,
      abi: CFG.abis.referral as any,
      client: wrapped as any,
    }),
  } as const;
}

