// app/api/merge/route.ts
import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { gameCoreAddress, gameCoreABI } from "../../lib/web3Config";

export const runtime = "nodejs";

const RPC_URL = process.env.RPC_URL || "https://mainnet.base.org";
const RELAYER_PK = process.env.RELAYER_PRIVATE_KEY as `0x${string}` | undefined;

const publicClient = createPublicClient({
  chain: base,
  transport: http(RPC_URL),
});

function getWalletClient() {
  if (!RELAYER_PK) throw new Error("RELAYER_PRIVATE_KEY is not set");
  const account = privateKeyToAccount(RELAYER_PK);
  return createWalletClient({
    account,
    chain: base,
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
      return NextResponse.json({ ok: false, error: "bad params: user and kind required" }, { status: 400 });
    }

    if (!RELAYER_PK) {
      return NextResponse.json({ ok: false, error: "Relayer not configured" }, { status: 500 });
    }

    const walletClient = getWalletClient();
    const account = walletClient.account;

    const functionName = kind === "BASIC_TO_PRO" ? "mergeBasicToPro" : "mergeProToLegend";
    const args = [user, BigInt(fid)] as const;

    // Simulate first to catch reverts with clear messages
    try {
      await publicClient.simulateContract({
        address: gameCoreAddress as `0x${string}`,
        abi: gameCoreABI as any,
        functionName,
        args,
        account,
      });
    } catch (simErr: any) {
      const msg = simErr?.shortMessage || simErr?.message || "Simulation failed";
      return NextResponse.json(
        { ok: false, error: `Simulation revert: ${msg}` },
        { status: 400 }
      );
    }

    // Execute the transaction
    const txHash = await walletClient.writeContract({
      address: gameCoreAddress as `0x${string}`,
      abi: gameCoreABI as any,
      functionName,
      args,
      account,
      chain: base,
    });

    // Wait for receipt so we know it succeeded
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    if (receipt.status !== "success") {
      return NextResponse.json(
        { ok: false, error: "Transaction reverted on-chain", tx: txHash },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, tx: txHash });
  } catch (e: any) {
    const msg = e?.shortMessage || e?.message || "merge failed";
    console.error("Merge error:", e);
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500 }
    );
  }
}
