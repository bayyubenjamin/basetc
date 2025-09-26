// app/lib/server/relayerClient.ts
import "server-only";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

const RPC = process.env.RPC_URL;
let PK = process.env.RELAYER_PRIVATE_KEY as string | undefined;

if (!RPC) throw new Error("RPC_URL is missing");
if (!PK) throw new Error("RELAYER_PRIVATE_KEY is missing");
if (!PK.startsWith("0x")) PK = `0x${PK}`;

const account = privateKeyToAccount(PK as `0x${string}`);

export const relayerAddress = account.address;

export const relayerClient = createWalletClient({
  chain: baseSepolia,
  transport: http(RPC),
  account,
});

