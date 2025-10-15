// app/api/notify-epoch/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createPublicClient, http, getContract } from "viem";
import { base } from "viem/chains";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ==== ENV ====
// Kontrak GameCore di Base (punya fungsi view epochNow(): uint256)
const gameCoreAddress = process.env.CONTRACT_GAMECORE as `0x${string}` | undefined;

// Supabase server-side (gunakan SERVICE_ROLE_KEY, jangan anon)
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ==== ABI minimal hanya untuk epochNow ====
const gameCoreABI = [
  {
    type: "function",
    name: "epochNow",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// ==== Types sederhana untuk baris tabel ====
type TokenRow = {
  fid: number;
  token: string;
  url: string;
  last_epoch_notified: number;
  disabled: boolean;
};

// Helper JSON response
function json(body: any, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function GET() {
  try {
    if (!gameCoreAddress) {
      return json({ ok: false, error: "Missing env CONTRACT_GAMECORE" }, 500);
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json({ ok: false, error: "Missing Supabase server env" }, 500);
    }

    // 1) Baca epoch sekarang dari kontrak
    const publicClient = createPublicClient({ chain: base, transport: http() });
    const gameCore = getContract({
      address: gameCoreAddress,
      abi: gameCoreABI,
      client: { public: publicClient as any }, // bypass typing viem agar tidak error build
    });
    const epochNowBn = await gameCore.read.epochNow();
    const currentEpoch = Number(epochNowBn);

    // 2) Ambil token yang perlu dikirimi (last_epoch_notified < currentEpoch & aktif)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await supabase
      .from("farcaster_tokens")
      .select("fid, token, url, last_epoch_notified, disabled")
      .eq("disabled", false)
      .lt("last_epoch_notified", currentEpoch);

    if (error) throw error;

    const rows = (data || []) as TokenRow[];

    if (rows.length === 0) {
      // Tetap JSON agar bisa | jq .
      return json({ ok: true, epoch: currentEpoch, message: "No users need notification", results: [] });
    }

    // 3) Kelompokkan per server URL (Farcaster notification endpoint)
    const byUrl: Record<string, TokenRow[]> = {};
    for (const r of rows) (byUrl[r.url] ??= []).push(r);

    const notificationId = `epoch-reminder-${currentEpoch}`; // idempotent per epoch
    const title = `Epoch ${currentEpoch} dimulai`;
    const body = `Klaim harianmu untuk epoch ${currentEpoch} sekarang.`;
    const targetUrl = "https://basetc.xyz/launch";

    const results: Array<{
      url: string;
      sent: number;
      succeeded: number;
      invalid: number;
      rateLimited: number;
      sampleFids?: number[];
    }> = [];

    // 4) Kirim per-URL, batch per 100 token
    for (const [serverUrl, list] of Object.entries(byUrl)) {
      let succ = 0, inv = 0, rl = 0, sent = 0;

      for (let i = 0; i < list.length; i += 100) {
        const chunk = list.slice(i, i + 100);
        const tokens = chunk.map((c) => c.token);
        sent += tokens.length;

        const resp = await fetch(serverUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            notificationId,
            title,
            body,
            targetUrl,
            tokens,
          }),
        });

        const jr = await resp.json().catch(() => ({} as any));
        const successfulTokens: string[] = jr.successfulTokens || [];
        const invalidTokens: string[] = jr.invalidTokens || [];
        const rateLimitedTokens: string[] = jr.rateLimitedTokens || [];

        succ += successfulTokens.length;
        inv += invalidTokens.length;
        rl += rateLimitedTokens.length;

        // 5) Update DB: sukses -> last_epoch_notified = currentEpoch
        if (successfulTokens.length > 0) {
          const fidsOk = chunk.filter((c) => successfulTokens.includes(c.token)).map((c) => c.fid);
          if (fidsOk.length > 0) {
            await supabase
              .from("farcaster_tokens")
              .update({ last_epoch_notified: currentEpoch })
              .in("fid", fidsOk);
          }
        }

        // 6) Token invalid -> disabled = true
        if (invalidTokens.length > 0) {
          const fidsBad = chunk.filter((c) => invalidTokens.includes(c.token)).map((c) => c.fid);
          if (fidsBad.length > 0) {
            await supabase.from("farcaster_tokens").update({ disabled: true }).in("fid", fidsBad);
          }
        }
      }

      results.push({
        url: serverUrl,
        sent,
        succeeded: succ,
        invalid: inv,
        rateLimited: rl,
        sampleFids: (byUrl[serverUrl] || []).slice(0, 5).map((r) => r.fid),
      });
    }

    // 7) Balikkan ringkasan
    return json({ ok: true, epoch: currentEpoch, results });
  } catch (e: any) {
    console.error("[notify-epoch] error:", e?.message || e);
    return json({ ok: false, error: e?.message || "notify-epoch-error" }, 500);
  }
}

