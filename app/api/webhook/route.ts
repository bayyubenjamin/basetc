// app/api/webhook/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// helper: base64url → JSON
function b64urlToJson<T = any>(b64url: string): T {
  const norm = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = norm.length % 4 === 2 ? "==" : norm.length % 4 === 3 ? "=" : "";
  const str = Buffer.from(norm + pad, "base64").toString("utf8");
  return JSON.parse(str);
}

export async function GET()  { return new NextResponse("ok", { status: 200 }); }
export async function HEAD() { return new NextResponse(null, { status: 200 }); }
export async function OPTIONS() { return new NextResponse(null, { status: 204 }); }

export async function POST(req: Request) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1) Ambil body apa adanya
    const raw: any = await req.json().catch(() => ({}));

    // 2) Normalisasi ke bentuk { event, user, notificationDetails }
    let eventType: string | undefined;
    let fid: number | undefined;
    let notificationDetails: { url?: string; token?: string } | undefined;

    if (raw && typeof raw === "object" && raw.header && raw.payload && raw.signature) {
      // ==== JFS MODE (Warpcast dsb) ====
      // payload = base64url(JSON string)
      const payload = b64urlToJson<any>(raw.payload);
      eventType = payload?.event;
      fid = payload?.user?.fid ?? payload?.fid;
      notificationDetails = payload?.notificationDetails;
      console.log("[WEBHOOK:JFS]", eventType, "fid=", fid, "hasNotif=", !!notificationDetails);
    } else {
      // ==== RAW JSON MODE (dev / curl manual) ====
      eventType = raw?.event;
      fid = raw?.user?.fid ?? raw?.fid;
      notificationDetails = raw?.notificationDetails;
      console.log("[WEBHOOK:RAW]", eventType, "fid=", fid, "hasNotif=", !!notificationDetails);
    }

    // 3) Simpan token saat add/enable
    if (
      fid &&
      notificationDetails?.token &&
      notificationDetails?.url &&
      (eventType === "miniapp_added" || eventType === "notifications_enabled")
    ) {
      await supabase
        .from("farcaster_tokens")
        .upsert(
          {
            fid,
            token: notificationDetails.token,
            url: notificationDetails.url,
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
    // tetap 200 supaya host nggak spam retry
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

