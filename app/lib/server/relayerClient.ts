// app/lib/server/relayerClient.ts
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { CFG } from "../web3Config";

export async function getRelayerClients() {
  const RPC_URL = process.env.RPC_URL || CFG.rpcUrl;
  const PK = process.env.RELAYER_PRIVATE_KEY; // WAJIB pakai prefix 0x

  if (!PK) throw new Error("RELAYER_PRIVATE_KEY missing");

  const account = privateKeyToAccount(PK as `0x${string}`);

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(RPC_URL),
  });

  const walletClient = createWalletClient({
    chain: baseSepolia,
    transport: http(RPC_URL),
    account,
  });

  return { publicClient, walletClient, account };
}

