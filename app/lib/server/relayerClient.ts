// app/lib/server/relayerClient.ts
"use server";

import { createPublicClient, createWalletClient, http, getContract, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { CFG } from "../web3Config"; // ⬅️ relative (file ini ada di app/lib/server, jadi ../web3Config)

export async function getRelayerClients() {
  const RPC_URL = process.env.RPC_URL || CFG.rpcUrl;
  const PK = process.env.RELAYER_PRIVATE_KEY; // harus dengan prefix 0x

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

  const gameCore = getContract({
    address: CFG.addresses.GAMECORE as Address,
    abi: CFG.abis.gameCore as any,
    client: { public: publicClient, wallet: walletClient },
  });

  return { publicClient, walletClient, gameCore, account };
}

