// app/api/webhook/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseWebhookEvent } from "@farcaster/miniapp-node";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET()  { return new NextResponse("ok", { status: 200 }); }
export async function HEAD() { return new NextResponse(null, { status: 200 }); }
export async function OPTIONS() { return new NextResponse(null, { status: 204 }); }

export async function POST(req: Request) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const raw = await req.json().catch(() => ({}));
    let eventType: string | undefined;
    let fid: number | undefined;
    let details: { url?: string; token?: string } | undefined;

    // 1) Coba parse JFS (header/payload/signature)
    try {
      const parsed = await parseWebhookEvent(raw);
      eventType = parsed?.event;
      fid = parsed?.user?.fid;
      details = parsed?.notificationDetails;
      console.log("[WEBHOOK:JFS]", eventType, "fid=", fid, "hasNotif=", !!details);
    } catch (e) {
      // 2) Fallback: mungkin host kirim raw JSON tanpa JFS (untuk debugging/dev)
      eventType = raw?.event;
      fid = raw?.user?.fid ?? raw?.fid;
      details = raw?.notificationDetails;
      console.log("[WEBHOOK:RAW]", eventType, "fid=", fid, "hasNotif=", !!details);
    }

    // 3) Simpan token saat add/enable
    if (
      fid &&
      details?.token &&
      details?.url &&
      (eventType === "miniapp_added" || eventType === "notifications_enabled")
    ) {
      await supabase
        .from("farcaster_tokens")
        .upsert(
          {
            fid,
            token: details.token,
            url: details.url,
            last_epoch_notified: 0,
            disabled: false,
          },
          { onConflict: "fid,token" }
        );
      console.log("[WEBHOOK] UPSERT OK fid=", fid);
    }

    // 4) Nonaktifkan saat remove/disable
    if (fid && (eventType === "miniapp_removed" || eventType === "notifications_disabled")) {
      await supabase.from("farcaster_tokens").update({ disabled: true }).eq("fid", fid);
      console.log("[WEBHOOK] DISABLED fid=", fid);
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    console.error("[WEBHOOK] ERR:", e?.message || e);
    // tetap 200 supaya host gak retry spam
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

