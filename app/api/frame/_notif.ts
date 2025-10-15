// app/api/frame/_notif.ts
import { createClient } from "@supabase/supabase-js";

type AnyObj = Record<string, any>;

// base64url -> JSON
function b64urlToJson<T = any>(b64url: string): T {
  const norm = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = norm.length % 4 === 2 ? "==" : norm.length % 4 === 3 ? "=" : "";
  const str = Buffer.from(norm + pad, "base64").toString("utf8");
  return JSON.parse(str);
}

// temukan bentuk JFS {header,payload,signature} di berbagai struktur body
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

async function upsertToken(fid: number, url: string, token: string) {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  await supabase
    .from("farcaster_tokens")
    .upsert(
      { fid, token, url, last_epoch_notified: 0, disabled: false },
      { onConflict: "fid,token" }
    );
}

/**
 * Early handler untuk request ke /api/frame yang ternyata berisi notifikasi Farcaster.
 * Return true bila token berhasil diproses (caller bisa langsung return 200).
 */
export async function tryHandleFarcasterNotification(req: Request): Promise<boolean> {
  try {
    const text = await req.clone().text();
    let body: AnyObj;
    try { body = JSON.parse(text); } catch { return false; }

    const jfs = extractJfsLike(body);
    if (!jfs) return false;

    const payload = b64urlToJson<AnyObj>(jfs.payload);
    const eventType: string | undefined = payload?.event;
    const details = payload?.notificationDetails as AnyObj | undefined;
    const fid =
      typeof payload?.user?.fid === "number"
        ? payload.user.fid
        : (typeof payload?.fid === "number" ? payload.fid : undefined);

    // event yang membawa token
    const isNotifEvent =
      eventType === "frame_added" ||
      eventType === "miniapp_added" ||
      eventType === "notifications_enabled";

    if (isNotifEvent && fid && details?.token && details?.url) {
      await upsertToken(fid, String(details.url), String(details.token));
      console.log("[FRAME WEBHOOK] token upsert OK for fid", fid, "event=", eventType);
      return true;
    }

    return false;
  } catch (e: any) {
    console.warn("[FRAME WEBHOOK] parse fail:", e?.message || e);
    return false;
  }
}

