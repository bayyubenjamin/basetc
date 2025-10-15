// app/api/notify-epoch/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
// --- SESUAIKAN ini ---
const gameCoreAddress = process.env.GAME_CORE_ADDRESS as `0x${string}`;
import gameCoreABI from "@/lib/abi/GameCore.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = {
  fid: number;
  token: string;
  url: string;
  last_epoch_notified: number;
  disabled: boolean;
};

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
    // 1) Epoch sekarang dari kontrak
    const publicClient = createPublicClient({ chain: base, transport: http() });
    const epochNowBn = await publicClient.readContract({
      address: gameCoreAddress,
      abi: gameCoreABI as any,
      functionName: "epochNow",
    });
    const currentEpoch = Number(epochNowBn);

    // 2) Ambil token yang perlu dikirim (last_epoch_notified < currentEpoch)
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data, error } = await supabase
      .from("farcaster_tokens")
      .select("fid, token, url, last_epoch_notified, disabled")
      .eq("disabled", false)
      .lt("last_epoch_notified", currentEpoch);
    if (error) throw error;

    const rows = (data || []) as Row[];
    if (rows.length === 0) {
      return json({ ok: true, epoch: currentEpoch, message: "No users need notification", results: [] });
    }

    // 3) Kelompok per server URL; batch per 100 token
    const byUrl: Record<string, Row[]> = {};
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

    for (const [serverUrl, list] of Object.entries(byUrl)) {
      let succ = 0, inv = 0, rl = 0, sent = 0;

      for (let i = 0; i < list.length; i += 100) {
        const chunk = list.slice(i, i + 100);
        const tokens = chunk.map(c => c.token);
        sent += tokens.length;

        const resp = await fetch(serverUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationId, title, body, targetUrl, tokens }),
        });

        const jsonResp = await resp.json().catch(() => ({} as any));
        const successfulTokens: string[] = jsonResp.successfulTokens || [];
        const invalidTokens: string[] = jsonResp.invalidTokens || [];
        const rateLimitedTokens: string[] = jsonResp.rateLimitedTokens || [];

        succ += successfulTokens.length;
        inv  += invalidTokens.length;
        rl   += rateLimitedTokens.length;

        // 4) Update DB: yang sukses -> last_epoch_notified = currentEpoch
        if (successfulTokens.length > 0) {
          const fidsOk = chunk
            .filter(c => successfulTokens.includes(c.token))
            .map(c => c.fid);
          if (fidsOk.length > 0) {
            await supabase
              .from("farcaster_tokens")
              .update({ last_epoch_notified: currentEpoch })
              .in("fid", fidsOk);
          }
        }

        // 5) Token invalid -> disabled = true
        if (invalidTokens.length > 0) {
          const fidsBad = chunk
            .filter(c => invalidTokens.includes(c.token))
            .map(c => c.fid);
          if (fidsBad.length > 0) {
            await supabase
              .from("farcaster_tokens")
              .update({ disabled: true })
              .in("fid", fidsBad);
          }
        }
      }

      results.push({
        url: serverUrl,
        sent,
        succeeded: succ,
        invalid: inv,
        rateLimited: rl,
        sampleFids: (byUrl[serverUrl] || []).slice(0, 5).map(r => r.fid),
      });
    }

    return json({ ok: true, epoch: currentEpoch, results });
  } catch (e: any) {
    console.error("[notify-epoch] error:", e?.message || e);
    return json({ ok: false, error: e?.message || "notify-epoch-error" }, 500);
  }
}

