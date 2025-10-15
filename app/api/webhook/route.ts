// app/api/webhook/route.ts
import { NextResponse } from "next/server";
import { parseWebhookEvent, verifyAppKeyWithNeynar } from "@farcaster/miniapp-node";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const evt = await parseWebhookEvent(json, verifyAppKeyWithNeynar);

    // Coerce supaya TS nggak salah narrow discriminated union
    const event = (evt as any)?.event as string | undefined;
    const details = (evt as any)?.notificationDetails as
      | { url: string; token: string }
      | undefined;

    // Simpan token saat add/enable
    if ((event === "miniapp_added" || event === "notifications_enabled") && details) {
      const { token, url } = details;
      const fid = (evt as any)?.fid as number | undefined;
      // TODO: upsert ke DB (fid, token, url, client)
      return NextResponse.json({ ok: true });
    }

    // Hapus token saat remove/disable
    if (event === "miniapp_removed" || event === "notifications_disabled") {
      const fid = (evt as any)?.fid as number | undefined;
      // TODO: delete by fid/client
      return NextResponse.json({ ok: true });
    }

    // Event lain: acknowledge saja
    return NextResponse.json({ ok: true, ignored: event ?? "unknown" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

