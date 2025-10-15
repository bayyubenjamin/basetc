// app/api/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
  // jaga-jaga kalau ada preflight dari klien tertentu
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/webhook" });
}

export async function POST(req: NextRequest) {
  const supa = createAdminClient();

  try {
    const evt = await req.json();

    // 1) LOG SEMUA EVENT MASUK – penting!
    await supa.from("basetc_webhook_log").insert({
      event_type: String(evt?.event || null),
      fid: Number(evt?.user?.fid || evt?.fid || 0) || null,
      raw: evt ?? null,
    });

    // 2) Normalisasi FID & notificationDetails
    const fid =
      (evt?.user && Number(evt.user.fid)) ||
      (typeof evt?.fid === "number" && evt.fid) ||
      null;

    const details = evt?.notificationDetails;
    const url = details?.url ?? null;
    const token = details?.token ?? null;

    // 3) Upsert status installs (sesuai event)
    if (evt?.event === "miniapp_added" && fid) {
      await supa.from("basetc_miniapp_installs").upsert({
        fid,
        added: true,
        updated_at: new Date().toISOString(),
      });
    }

    if (evt?.event === "notifications_enabled" && fid) {
      await supa.from("basetc_miniapp_installs").upsert({
        fid,
        added: true,
        notifications_enabled: true,
        notif_url: url,
        notif_token: token,
        updated_at: new Date().toISOString(),
      });
    }

    if (evt?.event === "notifications_disabled" && fid) {
      await supa.from("basetc_miniapp_installs").upsert({
        fid,
        notifications_enabled: false,
        updated_at: new Date().toISOString(),
      });
    }

    if (evt?.event === "miniapp_removed" && fid) {
      await supa.from("basetc_miniapp_installs").upsert({
        fid,
        added: false,
        notifications_enabled: false,
        updated_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    // log juga error ke tabel log
    try {
      await supa.from("basetc_webhook_log").insert({
        event_type: "error",
        fid: null,
        raw: { error: String(e?.message || e) },
      });
    } catch {}

    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 400 }
    );
  }
}

