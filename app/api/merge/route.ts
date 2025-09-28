// app/api/merge/route.ts
import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { gameCoreAddress, gameCoreABI } from "../../lib/web3Config";

export const runtime = "nodejs"; // penting: viem wallet client butuh Node, bukan Edge

const RPC_URL = process.env.RPC_URL || "https://sepolia.base.org";
const RELAYER_PK = process.env.RELAYER_PRIVATE_KEY as `0x${string}`;

// === clients ===
const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(RPC_URL),
});

function getWalletClient() {
  if (!RELAYER_PK) throw new Error("RELAYER_PRIVATE_KEY is not set");
  const account = privateKeyToAccount(RELAYER_PK);
  return createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(RPC_URL),
  });
}

/**
 * Body:
 * {
 *   "user": "0x....",
 *   "kind": "BASIC_TO_PRO" | "PRO_TO_LEGEND",
 *   "fid": number // optional, default 0 (untuk log event)
 * }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const user = body?.user as `0x${string}` | undefined;
    const kind = body?.kind as "BASIC_TO_PRO" | "PRO_TO_LEGEND" | undefined;
    const fid = Number.isFinite(body?.fid) ? Math.max(0, Math.floor(body.fid)) : 0;

    if (!user || !kind) {
      return NextResponse.json({ ok: false, error: "bad params" }, { status: 400 });
    }

    // ==== Read on-chain: usage & caps ====
    const usage = (await (publicClient as any).readContract({
      address: gameCoreAddress as `0x${string}`,
      abi: gameCoreABI as any,
      functionName: "miningUsage",
      args: [user],
    })) as bigint[];

    const caps = (await (publicClient as any).readContract({
      address: gameCoreAddress as `0x${string}`,
      abi: gameCoreABI as any,
      functionName: "rigCaps",
    })) as { b: bigint; p: bigint; l: bigint };

    const bOwned = Number(usage?.[0] ?? 0n);
    const pOwned = Number(usage?.[3] ?? 0n);
    const lOwned = Number(usage?.[6] ?? 0n);
    const pUsed  = Number(usage?.[4] ?? 0n);
    const lUsed  = Number(usage?.[7] ?? 0n);

    const capP = Number(caps?.p ?? 0n);
    const capL = Number(caps?.l ?? 0n);

    const walletClient = getWalletClient();

    if (kind === "BASIC_TO_PRO") {
      const needB2PBig = (await (publicClient as any).readContract({
        address: gameCoreAddress as `0x${string}`,
        abi: gameCoreABI as any,
        functionName: "BASIC_TO_PRO_NEED",
      })) as bigint;
      const needB2P = Number(needB2PBig);

      if (bOwned < needB2P) {
        return NextResponse.json({ ok: false, error: "insufficient basic" }, { status: 400 });
      }
      if (pUsed >= capP) {
        return NextResponse.json({ ok: false, error: "pro slot full" }, { status: 400 });
      }

      const tx = await walletClient.writeContract({
        address: gameCoreAddress as `0x${string}`,
        abi: gameCoreABI as any,
        functionName: "mergeBasicToPro",
        args: [user, BigInt(fid)],
      });

      return NextResponse.json({ ok: true, tx });
    } else {
      const needP2LBig = (await (publicClient as any).readContract({
        address: gameCoreAddress as `0x${string}`,
        abi: gameCoreABI as any,
        functionName: "PRO_TO_LEGEND_NEED",
      })) as bigint;
      const needP2L = Number(needP2LBig);

      if (pOwned < needP2L) {
        return NextResponse.json({ ok: false, error: "insufficient pro" }, { status: 400 });
      }
      if (lUsed >= capL) {
        return NextResponse.json({ ok: false, error: "legend slot full" }, { status: 400 });
      }
      if (lOwned >= capL) {
        return NextResponse.json({ ok: false, error: "legend wallet limit" }, { status: 400 });
      }

      const tx = await walletClient.writeContract({
        address: gameCoreAddress as `0x${string}`,
        abi: gameCoreABI as any,
        functionName: "mergeProToLegend",
        args: [user, BigInt(fid)],
      });

      return NextResponse.json({ ok: true, tx });
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "merge failed" }, { status: 500 });
  }
}

