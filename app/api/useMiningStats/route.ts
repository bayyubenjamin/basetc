// app/api/useMiningStats/route.ts
import { NextResponse } from "next/server";
import { createPublicClient, http, isAddress, formatEther } from "viem";
import { gameCoreABI } from "../../lib/web3Config";

// Pastikan route handler berjalan di Node (bukan Edge)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// --- ENV & client setup ---
const RPC_URL = process.env.RPC_URL || "https://mainnet.base.org"; // Ganti RPC
const CHAIN_ID = Number(process.env.CHAIN_ID || 8453); // Ganti Chain ID
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

// --- helpers (defensive) ---
function toNum18(x?: bigint | null) {
  try {
    if (!x) return 0;
    return Number(formatEther(x));
  } catch {
    return 0;
  }
}

export async function GET(req: Request) {
  try {
    if (!GAMECORE) {
      return NextResponse.json(
        { error: "CONTRACT_GAMECORE / NEXT_PUBLIC_CONTRACT_GAMECORE belum diset" },
        { status: 500 }
      );
    }

    const url = new URL(req.url);
    const user = url.searchParams.get("address");

    if (!user || !isAddress(user)) {
      return NextResponse.json(
        { error: "Query ?address=0x... tidak valid" },
        { status: 400 }
      );
    }

    const userAddr = user as `0x${string}`;

    // panggil kontrak (safe-cast ke any biar tidak bentrok TS typing viem)
    let usageRaw: any = null;
    let baseUnitRaw: any = null;
    let baseRwRaw: any = null;
    let warning: string | undefined;

    try {
      [usageRaw, baseUnitRaw, baseRwRaw] = await Promise.all([
        (client as any).readContract({
          address: GAMECORE,
          abi: gameCoreABI,
          functionName: "miningUsage",
          args: [userAddr],
        }),
        (client as any).readContract({
          address: GAMECORE,
          abi: gameCoreABI,
          functionName: "getBaseUnit",
          args: [userAddr],
        }),
        (client as any).readContract({
          address: GAMECORE,
          abi: gameCoreABI,
          functionName: "baseRw",
        }),
      ]);
    } catch (e: any) {
      warning = e?.message || "readContract failed";
      // lanjut dengan default 0 agar UI tetap render
    }

    // ----- parse usage (9 return values) -----
    const arr = Array.isArray(usageRaw) ? (usageRaw as bigint[]) : [];
    const [
      bOwned = 0n, bUsed = 0n, bIdle = 0n,
      pOwned = 0n, pUsed = 0n, pIdle = 0n,
      lOwned = 0n, lUsed = 0n, lIdle = 0n,
    ] = arr;

    // ----- parse baseRw struct -----
    const baseRw = (baseRwRaw ?? { b: 0n, p: 0n, l: 0n }) as {
      b: bigint; p: bigint; l: bigint;
    };

    /* ✅ BIGINT-SAFE RATIO (hindari NaN/precision loss)
       Efektif hashrate = usedBasic*1 + usedPro*(p/b) + usedLegend*(l/b)
       Kita hitung (p/b) & (l/b) memakai skala integer agar stabil. */
    const SCALE = 1_000_000n; // presisi 1e6 cukup untuk UI
    let ratioPScaled = 0n;
    let ratioLScaled = 0n;
    if (baseRw.b > 0n) {
      ratioPScaled = (baseRw.p * SCALE) / baseRw.b; // ≈ (p/b)*1e6
      ratioLScaled = (baseRw.l * SCALE) / baseRw.b; // ≈ (l/b)*1e6
    }

    // effScaled = (bUsed*1 + pUsed*ratioP + lUsed*ratioL) * SCALE
    const effScaled =
      (bUsed * SCALE) + (pUsed * ratioPScaled) + (lUsed * ratioLScaled);

    // angka untuk UI, dibulatkan ke bawah (stabil)
    const effectiveHashrate = Number(effScaled / SCALE);

    const payload = {
      address: userAddr,
      contract: GAMECORE,
      usage: {
        basic: { owned: Number(bOwned), used: Number(bUsed), idle: Number(bIdle) },
        pro:   { owned: Number(pOwned), used: Number(pUsed), idle: Number(pIdle) },
        legend:{ owned: Number(lOwned), used: Number(lUsed), idle: Number(lIdle) },
      },
      baseRw: {
        basicPerDay: toNum18(baseRw.b),
        proPerDay:    toNum18(baseRw.p),
        legendPerDay: toNum18(baseRw.l),
      },
      // Rasio (debug/insight): dalam "x Basic"
      ratios: {
        proVsBasic: Number(ratioPScaled) / Number(SCALE),     // ≈ p/b
        legendVsBasic: Number(ratioLScaled) / Number(SCALE),  // ≈ l/b
      },
      baseUnitEpoch: toNum18(baseUnitRaw as bigint),
      effectiveHashrate,
      warning, // opsional, biar bisa ditampilkan kecil di UI
    };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "max-age=10, s-maxage=10, stale-while-revalidate=60",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Internal error" },
      { status: 500 }
    );
  }
}

