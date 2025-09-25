import { getContract, type PublicClient, type WalletClient } from "viem";
import { CFG } from "./web3Config";

// Bentuk client yang diharapkan getContract (salah satu saja: public atau wallet)
type ContractClient = { public: PublicClient } | { wallet: WalletClient };

export function makeContracts(client: PublicClient | WalletClient) {
  // Deteksi & bungkus ke shape yang benar untuk viem
  const wrapped: ContractClient =
    // WalletClient biasanya punya properti `account` atau `key` berbeda.
    (client as WalletClient)?.account !== undefined
      ? { wallet: client as WalletClient }
      : { public: client as PublicClient };

  return {
    gameCore: getContract({
      address: CFG.addresses.GAMECORE as `0x${string}`,
      abi: CFG.abis.gameCore as any,
      client: wrapped,
    }),
    rigNft: getContract({
      address: CFG.addresses.RIGNFT as `0x${string}`,
      abi: CFG.abis.rigNft as any,
      client: wrapped,
    }),
    rigSale: getContract({
      address: CFG.addresses.RIGSALE as `0x${string}`,
      abi: CFG.abis.rigSale as any,
      client: wrapped,
    }),
    rewards: getContract({
      address: CFG.addresses.REWARDS_VAULT as `0x${string}`,
      abi: CFG.abis.rewardsVault as any,
      client: wrapped,
    }),
    treasury: getContract({
      address: CFG.addresses.TREASURY as `0x${string}`,
      abi: CFG.abis.treasuryVault as any,
      client: wrapped,
    }),
    baseTc: getContract({
      address: CFG.addresses.BASETC as `0x${string}`,
      abi: CFG.abis.baseTc as any,
      client: wrapped,
    }),
    referral: getContract({
      address: CFG.addresses.REFERRAL as `0x${string}`,
      abi: CFG.abis.referral as any,
      client: wrapped,
    }),
  } as const;
}

