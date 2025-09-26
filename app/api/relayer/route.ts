// app/api/relayer/route.ts
import "server-only";
import { NextResponse } from "next/server";

// ⬇️ GANTI alias ke relative path
import { relayerClient, relayerAddress } from "../../lib/server/relayerClient";
import { gameCoreAddress, gameCoreABI } from "../../lib/web3Config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function isAuthorized(req: Request) {
  const needKey = process.env.RELAYER_API_KEY;
  if (!needKey) return true;
  return req.headers.get("x-api-key") === needKey;
}

type WriteResult = { ok: true; tx: `0x${string}` } | { ok: false; error: string };

async function write<TArgs extends any[]>(
  fn: string,
  args: TArgs
): Promise<WriteResult> {
  try {
    const tx = await (relayerClient as any).writeContract({
      address: gameCoreAddress as `0x${string}`,
      abi: gameCoreABI as any,
      functionName: fn,
      args: args as any[],
    });
    return { ok: true, tx };
  } catch (e: any) {
    return { ok: false, error: e?.shortMessage || e?.message || "failed" };
  }
}

export async function GET() {
  try {
    const epoch = (await (relayerClient as any).readContract({
      address: gameCoreAddress as `0x${string}`,
      abi: gameCoreABI as any,
      functionName: "epochNow",
      args: [],
    })) as bigint;

    return NextResponse.json({
      relayer: relayerAddress,
      chain: "base-sepolia",
      epochNow: epoch.toString(),
    });
  } catch {
    return NextResponse.json({
      relayer: relayerAddress,
      chain: "base-sepolia",
    });
  }
}

export async function POST(req: Request) {
  try {
    if (!isAuthorized(req))
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    const { action, args } = (await req.json()) as {
      action?: string;
      args?: any[];
    };

    if (!action) {
      return NextResponse.json({ ok: false, error: "missing action" }, { status: 400 });
    }

    if (action === "setMiningActive") {
      const [user, active] = args as [`0x${string}`, boolean];
      if (typeof user !== "string" || typeof active !== "boolean")
        return NextResponse.json({ ok: false, error: "bad args" }, { status: 400 });
      const res = await write("setMiningActive", [user, active]);
      return NextResponse.json(res, { status: res.ok ? 200 : 500 });
    }

    if (action === "setMiningCooldown") {
      const [secs] = args as [number];
      if (typeof secs !== "number")
        return NextResponse.json({ ok: false, error: "bad args" }, { status: 400 });
      const res = await write("setMiningCooldown", [BigInt(secs)]);
      return NextResponse.json(res, { status: res.ok ? 200 : 500 });
    }

    if (action === "pushSnapshot") {
      const [user] = args as [`0x${string}`];
      if (typeof user !== "string")
        return NextResponse.json({ ok: false, error: "bad args" }, { status: 400 });
      const res = await write("pushSnapshot", [user]);
      return NextResponse.json(res, { status: res.ok ? 200 : 500 });
    }

    if (action === "claim") {
      const [epoch, user] = args as [number | string | bigint, `0x${string}`];
      if ((typeof epoch !== "number" && typeof epoch !== "string" && typeof epoch !== "bigint") || typeof user !== "string")
        return NextResponse.json({ ok: false, error: "bad args" }, { status: 400 });
      const res = await write("claim", [BigInt(epoch), user]);
      return NextResponse.json(res, { status: res.ok ? 200 : 500 });
    }

    if (action === "mergeBasicToPro") {
      const [user, fid] = args as [`0x${string}`, number | string | bigint];
      if (typeof user !== "string")
        return NextResponse.json({ ok: false, error: "bad args" }, { status: 400 });
      const res = await write("mergeBasicToPro", [user, BigInt(fid)]);
      return NextResponse.json(res, { status: res.ok ? 200 : 500 });
    }

    if (action === "mergeProToLegend") {
      const [user, fid] = args as [`0x${string}`, number | string | bigint];
      if (typeof user !== "string")
        return NextResponse.json({ ok: false, error: "bad args" }, { status: 400 });
      const res = await write("mergeProToLegend", [user, BigInt(fid)]);
      return NextResponse.json(res, { status: res.ok ? 200 : 500 });
    }

    if (action === "finalizeEpoch") {
      const [e, totalHash, baseSum] = args as [
        number | string | bigint,
        number | string | bigint,
        number | string | bigint
      ];
      const res = await write("finalizeEpoch", [BigInt(e), BigInt(totalHash), BigInt(baseSum)]);
      return NextResponse.json(res, { status: res.ok ? 200 : 500 });
    }

    if (action === "burnLeftover") {
      const [e, amount] = args as [number | string | bigint, number | string | bigint];
      const res = await write("burnLeftover", [BigInt(e), BigInt(amount)]);
      return NextResponse.json(res, { status: res.ok ? 200 : 500 });
    }

    return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "failed" }, { status: 500 });
  }
}

