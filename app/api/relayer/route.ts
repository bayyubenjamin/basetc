// Run on Node.js (bukan Edge)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http, isAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

// Import config & ABI/addresses (server-safe)
import {
  rpcUrl,
  gameCoreAddress,
  gameCoreABI,
} from "@/app/lib/web3Config";

// --- Helpers ---
function json(data: any, init?: number | ResponseInit) {
  return NextResponse.json(data, init);
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function getClients() {
  const RPC_URL = requireEnv("RPC_URL");                  // ex: https://sepolia.base.org
  const PK = requireEnv("RELAYER_PRIVATE_KEY");           // HARUS ada "0x" di depan

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

// --- Handlers ---
async function handleSetActive(
  body: any,
  walletClient: ReturnType<typeof createWalletClient> extends infer T ? T : never
) {
  const user = body?.user as string | undefined;
  const active = body?.active as boolean | undefined;

  if (!user || !isAddress(user)) return { ok: false, error: "invalid user address" };
  if (typeof active !== "boolean") return { ok: false, error: "invalid active flag" };

  // Coba panggil setUserActive(user, active). Kalau ABI beda, fallback ke start/stop.
  try {
    const hash = await walletClient.writeContract({
      address: gameCoreAddress as `0x${string}`,
      abi: gameCoreABI as any,
      functionName: "setUserActive",
      args: [user as `0x${string}`, active],
    });
    return { ok: true, hash };
  } catch (e: any) {
    // Fallback bila kontrak kamu masih pakai startMining/stopMining
    try {
      const fn = active ? "startMining" : "stopMining";
      const hash2 = await walletClient.writeContract({
        address: gameCoreAddress as `0x${string}`,
        abi: gameCoreABI as any,
        functionName: fn,
        args: [user as `0x${string}`],
      });
      return { ok: true, hash: hash2 };
    } catch (e2: any) {
      return { ok: false, error: e2?.shortMessage || e2?.message || "set-active failed" };
    }
  }
}

// (opsional) contoh endpoint snapshot/claim/finalize kalau kamu butuh ke depannya
async function handlePushSnapshot(body: any) {
  return { ok: false, error: "not implemented" };
}
async function handleClaim(body: any) {
  return { ok: false, error: "not implemented" };
}
async function handleFinalize(body: any) {
  return { ok: false, error: "not implemented" };
}

// --- Route utama ---
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");

    const { walletClient, account } = await getClients();
    // Log tipis untuk debug di Vercel Logs
    console.log("[relayer] action:", action);
    console.log("[relayer] relayer:", account.address);
    console.log("[relayer] gameCore:", gameCoreAddress);
    console.log("[relayer] rpcUrl set:", Boolean(process.env.RPC_URL));

    if (action === "set-active") {
      const res = await handleSetActive(body, walletClient);
      return json(res, res.ok ? 200 : 400);
    }

    if (action === "push-snapshot") {
      const res = await handlePushSnapshot(body);
      return json(res, res.ok ? 200 : 400);
    }

    if (action === "claim") {
      const res = await handleClaim(body);
      return json(res, res.ok ? 200 : 400);
    }

    if (action === "finalize") {
      const res = await handleFinalize(body);
      return json(res, res.ok ? 200 : 400);
    }

    return json({ ok: false, error: "unknown action" }, 400);
  } catch (e: any) {
    console.error("[relayer] error:", e);
    return json({ ok: false, error: e?.message || "internal error" }, 500);
  }
}

