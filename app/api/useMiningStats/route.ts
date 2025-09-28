// app/api/useMiningStats/route.ts
import { NextResponse } from "next/server";
import { createPublicClient, http, isAddress, formatEther } from "viem";
import { gameCoreABI } from "../../lib/web3Config";

const RPC_URL = process.env.RPC_URL || "https://sepolia.base.org";
const CHAIN_ID = Number(process.env.CHAIN_ID || 84532);
const GAMECORE =
  (process.env.NEXT_PUBLIC_CONTRACT_GAMECORE ||
    process.env.CONTRACT_GAMECORE) as `0x${string}`;

const baseLike = {
  id: CHAIN_ID,
  name: "base-like",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
} as const;

const client = createPublicClient({
  chain: baseLike,
  transport: http(RPC_URL),
});

export async function GET(req: Request) {
  try {
    if (!GAMECORE) {
      return NextResponse.json(
        { error: "CONTRACT_GAMECORE env belum diset" },
        { status: 500 }
      );
    }

    const url = new URL(req.url);
    const user = url.searchParams.get("address");

    if (!user || !isAddress(user as `0x${string}`)) {
      return NextResponse.json(
        { error: "Query ?address=0x... tidak valid" },
        { status: 400 }
      );
    }

    // 👇 cast ke any biar gak strict
    const [usageRaw, baseUnitRaw, baseRwRaw] = await Promise.all([
      (client as any).readContract({
        address: GAMECORE,
        abi: gameCoreABI,
        functionName: "miningUsage",
        args: [user],
      }),
      (client as any).readContract({
        address: GAMECORE,
        abi: gameCoreABI,
        functionName: "getBaseUnit",
        args: [user],
      }),
      (client as any).readContract({
        address: GAMECORE,
        abi: gameCoreABI,
        functionName: "baseRw",
      }),
    ]);

    const [
      bOwned, bUsed, bIdle,
      pOwned, pUsed, pIdle,
      lOwned, lUsed, lIdle,
    ] = usageRaw as bigint[];

    const baseRw = baseRwRaw as { b: bigint; p: bigint; l: bigint };

    const ratioP =
      Number(baseRw.b) === 0 ? 0 : Number(baseRw.p) / Number(baseRw.b);
    const ratioL =
      Number(baseRw.b) === 0 ? 0 : Number(baseRw.l) / Number(baseRw.b);

    const effectiveHashrate =
      Number(bUsed) * 1 + Number(pUsed) * ratioP + Number(lUsed) * ratioL;

    const baseUnitEpoch = Number(formatEther(baseUnitRaw as bigint));

    const payload = {
      address: user,
      contract: GAMECORE,
      usage: {
        basic: { owned: Number(bOwned), used: Number(bUsed), idle: Number(bIdle) },
        pro:   { owned: Number(pOwned), used: Number(pUsed), idle: Number(pIdle) },
        legend:{ owned: Number(lOwned), used: Number(lUsed), idle: Number(lIdle) },
      },
      baseRw: {
        basicPerDay: Number(formatEther(baseRw.b)),
        proPerDay:    Number(formatEther(baseRw.p)),
        legendPerDay: Number(formatEther(baseRw.l)),
      },
      baseUnitEpoch,
      effectiveHashrate: Math.round(effectiveHashrate),
    };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "max-age=15, s-maxage=15, stale-while-revalidate=60",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Internal error" },
      { status: 500 }
    );
  }
}

