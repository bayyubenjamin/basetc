// app/api/notify-epoch/route.ts
import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createPublicClient, http, getContract } from "viem";
import { base } from "viem/chains";
import { gameCoreAddress, gameCoreABI } from "../../lib/web3Config";

export const runtime = "nodejs";

type SendResp = {
  successfulTokens?: string[];
  invalidTokens?: string[];
  rateLimitedTokens?: string[];
};

export async function GET() {
  try {
    // 1) Init Supabase (service role)
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return new NextResponse(
        JSON.stringify({ error: "Supabase credentials missing" }),
        { status: 500 },
      );
    }
    const supabase = createSupabaseClient(supabaseUrl, serviceKey);

    // 2) Baca epoch dari GameCore (Viem-safe)
    const publicClient = createPublicClient({ chain: base, transport: http() });
    const gameCore = getContract({
      address: gameCoreAddress as `0x${string}`,
      abi: gameCoreABI as const,
      client: { public: publicClient },
    });
    const epochNowBn = await gameCore.read.epochNow();
    const currentEpoch = Number(epochNowBn);

    // 3) Ambil tokens aktif yang belum dikirimi notifikasi untuk epoch ini
    const { data: tokens, error: qErr } = await supabase
      .from("farcaster_tokens")
      .select("fid, token, url, last_epoch_notified")
      .eq("disabled", false);

    if (qErr) {
      throw qErr;
    }
    if (!tokens || tokens.length === 0) {
      return new NextResponse(
        JSON.stringify({ ok: true, epoch: currentEpoch, message: "No active tokens" }),
        { status: 200 },
      );
    }

    // 4) Kelompokkan per url server notifikasi + filter yg sudah notified
    const grouped: Record<string, typeof tokens> = {};
    for (const row of tokens) {
      if ((row.last_epoch_notified ?? 0) >= currentEpoch) continue;
      (grouped[row.url] ??= []).push(row);
    }
    if (Object.keys(grouped).length === 0) {
      return new NextResponse(
        JSON.stringify({ ok: true, epoch: currentEpoch, message: "All users already notified" }),
        { status: 200 },
      );
    }

    // 5) Kirim per-batch (max 100 tokens per request)
    const results: Array<{
      url: string;
      sent: number;
      succeeded: number;
      invalid: number;
      rateLimited: number;
    }> = [];

    const notificationId = `epoch-reminder-${currentEpoch}`; // idempotent
    const title = `Epoch ${currentEpoch} started`;
    const body = `The previous epoch has ended. Remember to claim your rewards!`;
    const targetUrl = `https://basetc.xyz/launch`;

    for (const [url, list] of Object.entries(grouped)) {
      for (let i = 0; i < list.length; i += 100) {
        const batch = list.slice(i, i + 100);
        const tokenList = batch.map((e) => e.token);

        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            notificationId,
            title,
            body,
            targetUrl,
            tokens: tokenList,
          }),
        });

        const json = (await resp.json().catch(() => ({}))) as SendResp;
        const successful = json.successfulTokens ?? [];
        const invalid = json.invalidTokens ?? [];
        const rateLimited = json.rateLimitedTokens ?? [];

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
          rateLimited: rateLimited.length,
        });
      }
    }

    return new NextResponse(
      JSON.stringify({ ok: true, epoch: currentEpoch, results }, null, 2),
      { status: 200 },
    );
  } catch (e: any) {
    console.error("notify-epoch error:", e);
    return new NextResponse(
      JSON.stringify({ error: e?.message || "notify-error" }),
      { status: 500 },
    );
  }
}

