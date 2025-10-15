import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { gameCoreAddress, gameCoreABI } from "../../lib/web3Config";

export const runtime = "nodejs";

export async function GET() {
  try {
    // Inisialisasi Supabase
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return new NextResponse(JSON.stringify({ error: "Supabase credentials missing" }), { status: 500 });
    }
    const supabase = createSupabaseClient(supabaseUrl, serviceKey);

    // Ambil epoch saat ini dari kontrak GameCore
    const publicClient = createPublicClient({ chain: base, transport: http() });
    const epochNow = await publicClient.readContract({
      address: gameCoreAddress as `0x${string}`,
      abi: gameCoreABI as any,
      functionName: "epochNow",
    });
    const currentEpoch = Number(epochNow);

    // Ambil semua token notifikasi aktif
    const { data: tokens } = await supabase
      .from("farcaster_tokens")
      .select("fid, token, url, last_epoch_notified")
      .eq("disabled", false);

    if (!tokens || tokens.length === 0) {
      return new NextResponse(JSON.stringify({ ok: true, message: "No active notification tokens" }), { status: 200 });
    }

    // Kelompokkan token per URL server notifikasi
    const grouped: Record<string, typeof tokens> = {};
    for (const row of tokens) {
      if (row.last_epoch_notified >= currentEpoch) continue;
      (grouped[row.url] ??= []).push(row);
    }

    const results: any[] = [];

    // Kirim notifikasi per batch (maks 100 token per permintaan:contentReference[oaicite:4]{index=4})
    for (const [url, entries] of Object.entries(grouped)) {
      for (let i = 0; i < entries.length; i += 100) {
        const batch = entries.slice(i, i + 100);
        const tokenList = batch.map((e) => e.token);
        const notificationId = `epoch-reminder-${currentEpoch}`;  // idempotent:contentReference[oaicite:5]{index=5}
        const title = `Epoch ${currentEpoch} started`;
        const body = `The previous epoch has ended. Remember to claim your rewards!`;
        const targetUrl = `https://basetc.xyz/launch`;

        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notificationId, title, body, targetUrl, tokens: tokenList }),
        });
        const json = (await resp.json().catch(() => null)) as {
          successfulTokens?: string[];
          invalidTokens?: string[];
          rateLimitedTokens?: string[];
        } | null;

        const successful = json?.successfulTokens ?? [];
        const invalid = json?.invalidTokens ?? [];

        if (successful.length > 0) {
          await supabase
            .from("farcaster_tokens")
            .update({ last_epoch_notified: currentEpoch })
            .in("token", successful);
        }
        if (invalid.length > 0) {
          await supabase
            .from("farcaster_tokens")
            .update({ disabled: true })
            .in("token", invalid);
        }

        results.push({
          url,
          sent: tokenList.length,
          succeeded: successful.length,
          invalid: invalid.length,
          rateLimited: (json?.rateLimitedTokens ?? []).length,
        });
      }
    }

    return new NextResponse(JSON.stringify({ ok: true, epoch: currentEpoch, results }), { status: 200 });
  } catch (e: any) {
    console.error("notify-epoch error:", e);
    return new NextResponse(JSON.stringify({ error: e?.message || "notify-error" }), { status: 500 });
  }
}

