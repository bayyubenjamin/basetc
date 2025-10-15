// app/api/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";

// Jalankan di Node runtime (bukan edge) karena perlu koneksi ke Supabase Node client
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * (OPSIONAL) Verifikasi sederhana dengan shared secret.
 * Jika kamu set ENV `WEBHOOK_SHARED_SECRET`, maka request harus punya header:
 *   x-basetc-webhook: <WEBHOOK_SHARED_SECRET>
 * Kalau tidak di-set, verifikasi dilewati (biar gampang saat development).
 */
function verifySharedSecret(req: NextRequest): boolean {
  const secret = process.env.WEBHOOK_SHARED_SECRET;
  if (!secret) return true; // tidak diaktifkan
  const got = req.headers.get("x-basetc-webhook");
  return got === secret;
}

/**
 * Normalisasi FID yang dikirim oleh klien Farcaster/Neynar.
 * Beberapa payload pakai evt.user.fid, kadang langsung evt.fid.
 */
function extractFid(evt: any): number | null {
  try {
    const a = Number(evt?.user?.fid || evt?.fid || 0);
    return Number.isFinite(a) && a > 0 ? a : null;
  } catch {
    return null;
  }
}

/**
 * Handler webhook:
 * - miniapp_added               -> added = true
 * - notifications_enabled       -> added = true, notifications_enabled = true, simpan url/token
 * - miniapp_removed             -> added = false, notifications_enabled = false
 * - notifications_disabled (?)  -> notifications_enabled = false (jika suatu saat dipakai)
 *
 * Catatan: Kita pakai upsert supaya idempotent.
 */
export async function POST(req: NextRequest) {
  try {
    if (!verifySharedSecret(req)) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    // Beberapa penyedia membungkus payload sebagai { event: "...", ... }
    // atau { data: { event: "...", ... } }. Kita ambil yang paling masuk akal.
    const evt: any = body?.data ?? body;

    const eventType: string = String(evt?.event || "");
    const fid = extractFid(evt);
    if (!eventType) {
      return NextResponse.json({ ok: false, error: "missing_event" }, { status: 400 });
    }
    if (!fid) {
      // Beberapa event bisa datang tanpa fid; kita log saja.
      console.warn("[webhook] missing fid for event:", eventType, "raw=", evt);
    }

    const supa = createAdminClient();

    // Helper untuk upsert status ke tabel
    async function upsertStatus(update: Record<string, any>) {
      if (!fid) return; // tanpa fid tidak bisa menyimpan status
      const payload = {
        fid,
        updated_at: new Date().toISOString(),
        ...update,
      };
      const { error } = await supa
        .from("basetc_miniapp_installs")
        .upsert(payload, { onConflict: "fid" });
      if (error) throw error;
    }

    switch (eventType) {
      case "miniapp_added": {
        await upsertStatus({
          added: true,
          // jangan mematikan flag notifikasi di sini — biarkan nilai terakhir
        });
        break;
      }

      case "notifications_enabled": {
        const details = evt?.notificationDetails || {};
        const url: string | null = details?.url ?? null;
        const token: string | null = details?.token ?? null;

        await upsertStatus({
          added: true, // enable notif berarti sudah Add
          notifications_enabled: true,
          notif_url: url,
          notif_token: token,
        });
        break;
      }

      case "miniapp_removed": {
        await upsertStatus({
          added: false,
          notifications_enabled: false,
          // opsional: hapus token/url jika mau benar-benar menonaktifkan
          // notif_url: null,
          // notif_token: null,
        });
        break;
      }

      // Jika nanti Farcaster kirim event ini (tidak semua klien),
      // kita tangani dengan aman.
      case "notifications_disabled": {
        await upsertStatus({
          notifications_enabled: false,
        });
        break;
      }

      default: {
        // Event lain yang belum kita kenali — aman kita terima saja supaya 2xx.
        console.log("[webhook] unhandled event:", eventType);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[webhook] error:", err?.message || err);
    return NextResponse.json(
      { ok: false, error: String(err?.message || err) },
      { status: 500 }
    );
  }
}

/**
 * GET untuk health check cepat (opsional).
 * Bisa diakses buat cek bahwa route hidup.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/webhook",
    ts: new Date().toISOString(),
  });
}

