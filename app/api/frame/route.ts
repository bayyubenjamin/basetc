// app/api/frame/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs"; // aman untuk Buffer base64 decoding

const CORS = {
  "Access-Control-Allow-Origin": "https://basetc.xyz",
  "Access-Control-Allow-Methods": "GET,POST,HEAD,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/** helper: base64url -> JSON */
function b64urlToJson<T = any>(b64url: string): T {
  const norm = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = norm.length % 4 === 2 ? "==" : norm.length % 4 === 3 ? "=" : "";
  const str = Buffer.from(norm + pad, "base64").toString("utf8");
  return JSON.parse(str);
}

/** helper: cari bentuk JFS {header,payload,signature} di berbagai struktur body */
function extractJfsLike(obj: any): any | null {
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

/**
 * Health check (validator sering GET ke webhook)
 */
export async function GET() {
  return new NextResponse("ok", {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
      ...CORS,
    },
  });
}

/**
 * Beberapa validator melakukan HEAD
 */
export async function HEAD() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      ...CORS,
    },
  });
}

/**
 * Preflight CORS
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...CORS,
    },
  });
}

/**
 * Webhook frame action (tetap POST 200)
 * - Tambahan: intercept payload Farcaster (JFS) yang membawa notificationDetails
 *   dan simpan token ke Supabase, TANPA mengganggu flow lain.
 */
export async function POST(req: Request) {
  try {
    // --- ambil raw text dulu supaya bisa handle semua bentuk (JSON/JFS/string) ---
    const text = await req.text();

    // coba parse JSON; kalau gagal ya tetap string
    let body: any = {};
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }

    // log asli-mu tetap dipanggil (tidak dihapus)
    console.log("Webhook hit /api/frame:", body);

    // --- Tambahan: intercept JFS berisi notificationDetails ---
    try {
      if (typeof body === "object" && body) {
        const jfs = extractJfsLike(body);
        if (jfs && jfs.payload) {
          const payload = b64urlToJson<any>(jfs.payload);
          const eventType: string | undefined = payload?.event;
          const details = payload?.notificationDetails as { url?: string; token?: string } | undefined;
          const fid =
            typeof payload?.user?.fid === "number"
              ? payload.user.fid
              : (typeof payload?.fid === "number" ? payload.fid : undefined);

          // event yang biasanya bawa token
          const isNotifEvent =
            eventType === "frame_added" ||
            eventType === "miniapp_added" ||
            eventType === "notifications_enabled";

          if (isNotifEvent && fid && details?.token && details?.url) {
            const supabase = createClient(
              process.env.SUPABASE_URL!,
              process.env.SUPABASE_SERVICE_ROLE_KEY!
            );

            await supabase
              .from("farcaster_tokens")
              .upsert(
                {
                  fid,
                  token: String(details.token),
                  url: String(details.url),
                  last_epoch_notified: 0,
                  disabled: false,
                },
                { onConflict: "fid,token" }
              );

            console.log("[FRAME WEBHOOK] token upsert OK for fid", fid, "event=", eventType);
          }
        }
      }
    } catch (e: any) {
      console.warn("[FRAME WEBHOOK] parse/insert failed:", e?.message || e);
      // sengaja tidak melempar error agar selalu balas 200 ke host
    }

    // --- balas 200 seperti sebelumnya (tanpa mengubah perilaku) ---
    return new NextResponse(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...CORS,
      },
    });
  } catch (err) {
    console.error("Error /api/frame:", err);
    return new NextResponse(JSON.stringify({ ok: false }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...CORS,
      },
    });
  }
}

