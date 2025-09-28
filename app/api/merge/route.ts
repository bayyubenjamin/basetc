// app/api/merge/route.ts
import { NextResponse } from "next/server";
import { createPublicClient, http, isAddress } from "viem";
import { gameCoreABI } from "../../lib/web3Config"; // pastikan path ini sesuai
import { ADDR, CHAIN } from "../../lib/addresses";

// === Setup client ===
const client = createPublicClient({
  chain: {
    id: CHAIN.id,
    name: "base-sepolia",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [CHAIN.rpcUrl] } },
  },
  transport: http(CHAIN.rpcUrl),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const user = url.searchParams.get("address");

    if (!user || !isAddress(user)) {
      return NextResponse.json(
        { error: "Query ?address=0x... tidak valid" },
        { status: 400 }
      );
    }
    const userAddr = user as `0x${string}`;

    // === Panggil kontrak paralel ===
    let usageRaw: bigint[] = [];
    let caps: { b: bigint; p: bigint; l: bigint } = { b: 0n, p: 0n, l: 0n };
    let needB2P = 0;
    let needP2L = 0;
    let feeB2P = 0n;
    let feeP2L = 0n;
    let warning: string | undefined;

    try {
      [
        usageRaw,
        caps,
        needB2P,
        needP2L,
        feeB2P,
        feeP2L,
      ] = await Promise.all([
        (client as any).readContract({
          address: ADDR.GAMECORE as `0x${string}`,
          abi: gameCoreABI as any,
          functionName: "miningUsage",
          args: [userAddr],
        }) as Promise<bigint[]>,
        (client as any).readContract({
          address: ADDR.GAMECORE as `0x${string}`,
          abi: gameCoreABI as any,
          functionName: "rigCaps",
        }) as Promise<{ b: bigint; p: bigint; l: bigint }>,
        (client as any).readContract({
          address: ADDR.GAMECORE as `0x${string}`,
          abi: gameCoreABI as any,
          functionName: "BASIC_TO_PRO_NEED",
        }) as Promise<bigint>,
        (client as any).readContract({
          address: ADDR.GAMECORE as `0x${string}`,
          abi: gameCoreABI as any,
          functionName: "PRO_TO_LEGEND_NEED",
        }) as Promise<bigint>,
        (client as any).readContract({
          address: ADDR.GAMECORE as `0x${string}`,
          abi: gameCoreABI as any,
          functionName: "BASIC_TO_PRO_FEE",
        }) as Promise<bigint>,
        (client as any).readContract({
          address: ADDR.GAMECORE as `0x${string}`,
          abi: gameCoreABI as any,
          functionName: "PRO_TO_LEGEND_FEE",
        }) as Promise<bigint>,
      ]);

      needB2P = Number(needB2P);
      needP2L = Number(needP2L);
    } catch (e: any) {
      warning = e?.message || "readContract failed";
    }

    // === Parse usage ===
    const [
      bOwned = 0n, bUsed = 0n, bIdle = 0n,
      pOwned = 0n, pUsed = 0n, pIdle = 0n,
      lOwned = 0n, lUsed = 0n, lIdle = 0n,
    ] = usageRaw;

    // === Business logic ===
    const canMergeBasicToPro = Number(bUsed) >= needB2P;
    const canMergeProToLegend = Number(pUsed) >= needP2L;

    const payload = {
      address: userAddr,
      contract: ADDR.GAMECORE,
      usage: {
        basic: { owned: Number(bOwned), used: Number(bUsed), idle: Number(bIdle) },
        pro: { owned: Number(pOwned), used: Number(pUsed), idle: Number(pIdle) },
        legend: { owned: Number(lOwned), used: Number(lUsed), idle: Number(lIdle) },
      },
      caps: {
        basicSlot: Number(caps.b),
        proSlot: Number(caps.p),
        legendSlot: Number(caps.l),
      },
      mergeRules: {
        basicToPro: { need: needB2P, fee: feeB2P.toString(), can: canMergeBasicToPro },
        proToLegend: { need: needP2L, fee: feeP2L.toString(), can: canMergeProToLegend },
      },
      warning,
    };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "max-age=10, s-maxage=10, stale-while-revalidate=60",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

