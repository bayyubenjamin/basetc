// app/api/notify-epoch/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Maks 100 token per request sesuai spesifikasi
const MAX_TOKENS_PER_BATCH = 100;

// Format ID harian untuk dedupe (lihat docs "Avoid duplicate notifications")
function makeNotificationId(d: Date) {
  // YYYY-MM-DD di zona Jakarta untuk konsistensi narasi "epoch harian"
  const jkt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(d) // "2025-10-15"
    .trim();
  return `epoch-${jkt}`;
}

// Pesan notifikasi harian
function buildMessage(d: Date) {
  const id = makeNotificationId(d);
  return {
    notificationId: id, // dedupe 24 jam (docs)
    title: "New epoch is live",
    body: "Open BaseTC now and claim your daily reward.",
    // targetUrl WAJIB satu domain dengan mini app (docs)
    targetUrl: `https://basetc.xyz/launch?src=notif-epoch&day=${id}`,
  };
}

async function sendBatchesByHost(hostUrl: string, tokens: string[], payload: Omit<ReturnType<typeof buildMessage>, "tokens">) {
  const results = { ok: 0, invalid: 0, rate: 0 };

  for (let i = 0; i < tokens.length; i += MAX_TOKENS_PER_BATCH) {
    const slice = tokens.slice(i, i + MAX_TOKENS_PER_BATCH);
    const body = {
      ...payload,
      tokens: slice,
    };

    // Panggil host Farcaster client sesuai URL yang diberikan saat webhook
    // Body harus: { notificationId, title, body, targetUrl, tokens[] } (lihat schema resmi)
    const res = await fetch(hostUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      // jangan gagal total; lanjut batch berikutnya
      continue;
    }
    const j = await res.json().catch(() => ({} as any));
    // Respons standar: { successfulTokens[], invalidTokens[], rateLimitedTokens[] }
    results.ok += Array.isArray(j?.successfulTokens) ? j.successfulTokens.length : 0;
    results.invalid += Array.isArray(j?.invalidTokens) ? j.invalidTokens.length : 0;
    results.rate += Array.isArray(j?.rateLimitedTokens) ? j.rateLimitedTokens.length : 0;
  }

  return results;
}

export async function GET(req: NextRequest) {
  try {
    // Opsional: ?dry=1 untuk uji coba tanpa kirim, ?date=YYYY-MM-DD untuk backfill
    const search = new URL(req.url).searchParams;
    const dryRun = search.get("dry") === "1";
    const atStr = search.get("date"); // jika mau backfill manual
    const at = atStr ? new Date(`${atStr}T07:00:00+07:00`) : new Date();

    const supa = createAdminClient();
    // Ambil semua user yang enable notifikasi
    const { data, error } = await supa
      .from("basetc_miniapp_installs")
      .select("fid, notifications_enabled, notif_url, notif_token")
      .eq("notifications_enabled", true);

    if (error) throw error;

    // Kelompokkan token per host URL (Warpcast vs host lain)
    const hostMap = new Map<string, string[]>();
    for (const row of data || []) {
      const url = row?.notif_url;
      const token = row?.notif_token;
      if (!url || !token) continue;
      if (!hostMap.has(url)) hostMap.set(url, []);
      hostMap.get(url)!.push(token);
    }

    const msg = buildMessage(at);

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        hosts: Array.from(hostMap).map(([u, arr]) => ({ url: u, tokens: arr.length })),
        message: msg,
      });
    }

    let totalOk = 0;
    let totalInvalid = 0;
    let totalRate = 0;

    for (const [url, tokens] of hostMap) {
      const r = await sendBatchesByHost(url, tokens, msg);
      totalOk += r.ok;
      totalInvalid += r.invalid;
      totalRate += r.rate;
      // TODO (opsional): kalau banyak invalidTokens, kamu bisa bersihkan dari DB
    }

    return NextResponse.json({
      ok: true,
      sent: totalOk,
      invalid: totalInvalid,
      rateLimited: totalRate,
      hosts: hostMap.size,
      notificationId: msg.notificationId,
    });
  } catch (e: any) {
    console.error("[notify-epoch] error:", e?.message || e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

