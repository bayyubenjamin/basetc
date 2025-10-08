// app/api/merge/route.ts
import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { gameCoreAddress, gameCoreABI } from "../../lib/web3Config";

export const runtime = "nodejs";

const RPC_URL = process.env.RPC_URL || "https://mainnet.base.org"; // Ganti RPC
const RELAYER_PK = process.env.RELAYER_PRIVATE_KEY as `0x${string}`;

const publicClient = createPublicClient({
  chain: base, // Ganti ke `base`
  transport: http(RPC_URL),
});

function getWalletClient() {
  if (!RELAYER_PK) throw new Error("RELAYER_PRIVATE_KEY is not set");
  const account = privateKeyToAccount(RELAYER_PK);
  return createWalletClient({
    account,
    chain: base, // Ganti ke `base`
    transport: http(RPC_URL),
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const user = body?.user as `0x${string}` | undefined;
    const kind = body?.kind as "BASIC_TO_PRO" | "PRO_TO_LEGEND" | undefined;
    const fid = Number.isFinite(body?.fid) ? Math.max(0, Math.floor(body.fid)) : 0;

    if (!user || !kind) {
      return NextResponse.json({ ok: false, error: "bad params" }, { status: 400 });
    }

    const walletClient = getWalletClient();
    const account = walletClient.account;

    if (kind === "BASIC_TO_PRO") {
      const tx = await walletClient.writeContract({
        address: gameCoreAddress as `0x${string}`,
        abi: gameCoreABI as any,
        functionName: "mergeBasicToPro",
        args: [user, BigInt(fid)],
        account,
        chain: baseSepolia,
      });
      return NextResponse.json({ ok: true, tx });
    } else {
      const tx = await walletClient.writeContract({
        address: gameCoreAddress as `0x${string}`,
        abi: gameCoreABI as any,
        functionName: "mergeProToLegend",
        args: [user, BigInt(fid)],
        account,
        chain: baseSepolia,
      });
      return NextResponse.json({ ok: true, tx });
    }
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "merge failed" },
      { status: 500 }
    );
  }
}

