// app/api/webhook/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnyObj = Record<string, any>;

// base64url -> JSON
function b64urlToJson<T = any>(b64url: string): T {
  const norm = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = norm.length % 4 === 2 ? "==" : norm.length % 4 === 3 ? "=" : "";
  const str = Buffer.from(norm + pad, "base64").toString("utf8");
  return JSON.parse(str);
}

// ambil kandidat objek {header,payload,signature} dari berbagai bentuk body
function extractJfsLike(obj: AnyObj): AnyObj | null {
  if (!obj || typeof obj !== "object") return null;
  if (obj.header && obj.payload && obj.signature) return obj;
  if (obj.data && obj.data.header && obj.data.payload && obj.data.signature) return obj.data;
  if (Array.isArray(obj.events) && obj.events.length > 0) {
    const ev = obj.events[0];
    if (ev.header && ev.payload && ev.signature) return ev;
    if (ev.data && ev.data.header && ev.data.payload && ev.data.signature) return ev.data;
  }
  return null;
}

// ambil bentuk raw JSON (tanpa JFS) yang mungkin nested
function extractRawLike(obj: AnyObj): AnyObj | null {
  if (!obj || typeof obj !== "object") return null;
  if (obj.event || obj.user || obj.notificationDetails) return obj;
  if (obj.data && (obj.data.event || obj.data.user || obj.data.notificationDetails)) return obj.data;
  if (Array.isArray(obj.events) && obj.events.length > 0) {
    const ev = obj.events[0];
    if (ev.event || ev.user || ev.notificationDetails) return ev;
    if (ev.data && (ev.data.event || ev.data.user || ev.data.notificationDetails)) return ev.data;
  }
  return null;
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

    // 1) Ambil raw text (menghindari gagal parse bila content-type/format aneh)
    const text = await req.text();
    let body: AnyObj | string = "";
    try { body = JSON.parse(text) as AnyObj; } catch { body = text; }

    let eventType: string | undefined;
    let fid: number | undefined;
    let details: { url?: string; token?: string } | undefined;

    if (typeof body === "string") {
      console.log("[WEBHOOK] body is plain string, len=", body.length);
    } else {
      // 2) Coba mode JFS dulu
      const jfs = extractJfsLike(body);
      if (jfs) {
        try {
          const payload = b64urlToJson<AnyObj>(jfs.payload);
          eventType = payload?.event;
          const payloadUser = payload?.user as AnyObj | undefined;
          fid = typeof payloadUser?.fid === "number" ? payloadUser!.fid : (payload as AnyObj)?.fid;
          details = payload?.notificationDetails as AnyObj | undefined;
          console.log("[WEBHOOK:JFS]", eventType, "fid=", fid, "hasNotif=", !!details);
        } catch (e) {
          console.warn("[WEBHOOK:JFS] decode payload gagal:", (e as any)?.message);
        }
      }

      // 3) Kalau JFS gagal / kosong, coba RAW-like
      if (!eventType) {
        const rawLike = extractRawLike(body);
        if (rawLike) {
          eventType = rawLike.event as string | undefined;
          const rawUser = rawLike.user as AnyObj | undefined;
          const fidFromUser = typeof rawUser?.fid === "number" ? rawUser!.fid : undefined;
          const fidFromRoot = (rawLike as AnyObj).fid;
          fid = typeof fidFromUser === "number" ? fidFromUser : (typeof fidFromRoot === "number" ? fidFromRoot : undefined);
          details = rawLike.notificationDetails as AnyObj | undefined;
          console.log("[WEBHOOK:RAW]", eventType, "fid=", fid, "hasNotif=", !!details);
        } else {
          console.log("[WEBHOOK] unknown body shape keys=", Object.keys(body));
        }
      }
    }

    // 4) Simpan token hanya saat add/enable + ada token & url
    if (
      fid &&
      details?.token &&
      details?.url &&
      (eventType === "miniapp_added" || eventType === "notifications_enabled")
    ) {
      await supabase
        .from("farcaster_tokens")
        .upsert(
          { fid, token: details.token!, url: details.url!, last_epoch_notified: 0, disabled: false },
          { onConflict: "fid,token" }
        );
      console.log("[WEBHOOK] UPSERT OK fid=", fid);
    }

    // 5) Nonaktifkan saat remove / disable
    if (fid && (eventType === "miniapp_removed" || eventType === "notifications_disabled")) {
      await supabase.from("farcaster_tokens").update({ disabled: true }).eq("fid", fid);
      console.log("[WEBHOOK] DISABLED fid=", fid);
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    console.error("[WEBHOOK] ERR:", e?.message || e);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

