import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
// import { parseWebhookEvent, verifyAppKeyWithNeynar } from "@farcaster/miniapp-node";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const payload = await req.json().catch(() => ({}));
    const { event: eventType, notificationDetails, user } = payload;
    const fid = user?.fid ?? payload?.fid;

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Supabase credentials missing" }, { status: 500 });
    }
    const supabase = createClient(supabaseUrl, serviceKey);

    // Simpan token ketika pengguna menambahkan atau mengaktifkan notifikasi
    if (
      (eventType === "miniapp_added" || eventType === "notifications_enabled") &&
      notificationDetails?.token &&
      notificationDetails?.url &&
      fid
    ) {
      const { token, url } = notificationDetails;
      await supabase
        .from("farcaster_tokens")
        .upsert(
          { fid, token, url, last_epoch_notified: 0, disabled: false },
          { onConflict: "fid,token" }
        );
    }

    // Nonaktifkan token ketika mini‑app dihapus atau notifikasi dimatikan
    if (
      (eventType === "miniapp_removed" || eventType === "notifications_disabled") &&
      fid
    ) {
      await supabase
        .from("farcaster_tokens")
        .update({ disabled: true })
        .eq("fid", fid);
    }

    // Selalu balas 200 agar Farcaster tidak melakukan retry:contentReference[oaicite:3]{index=3}.
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Webhook error:", e);
    return NextResponse.json({ error: e?.message || "webhook_error" }, { status: 400 });
  }
}

