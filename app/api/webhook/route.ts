// app/api/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function verifySharedSecret(req: NextRequest): boolean {
  const secret = process.env.WEBHOOK_SHARED_SECRET;
  if (!secret) return true;
  const got = req.headers.get("x-basetc-webhook");
  return got === secret;
}

function extractFid(evt: any): number | null {
  try {
    const a = Number(evt?.user?.fid || evt?.fid || 0);
    return Number.isFinite(a) && a > 0 ? a : null;
  } catch {
    return null;
  }
}

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

    const evt: any = body?.data ?? body;
    const eventType: string = String(evt?.event || "");
    const fid = extractFid(evt);

    if (!eventType) {
      return NextResponse.json({ ok: false, error: "missing_event" }, { status: 400 });
    }
    if (!fid) {
      console.warn("[webhook] missing fid for event:", eventType, "raw=", evt);
    }

    const supa = createAdminClient();

    async function upsertStatus(update: Record<string, any>) {
      if (!fid) return;
      const payload = { fid, updated_at: new Date().toISOString(), ...update };
      const { error } = await supa
        .from("basetc_miniapp_installs")
        .upsert(payload, { onConflict: "fid" });
      if (error) throw error;
    }

    switch (eventType) {
      case "miniapp_added": {
        await upsertStatus({ added: true });
        break;
      }
      case "notifications_enabled": {
        const details = evt?.notificationDetails || {};
        const url: string | null = details?.url ?? null;
        const token: string | null = details?.token ?? null;

        await upsertStatus({
          added: true,
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
          // notif_url: null,
          // notif_token: null,
        });
        break;
      }
      case "notifications_disabled": {
        await upsertStatus({ notifications_enabled: false });
        break;
      }
      default: {
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

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/webhook",
    ts: new Date().toISOString(),
  });
}

