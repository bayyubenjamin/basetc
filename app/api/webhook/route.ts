// app/api/webhook/route.ts
import { NextResponse } from "next/server";
import {
  parseWebhookEvent,
  verifyAppKeyWithNeynar,
} from "@farcaster/miniapp-node";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const evt = await parseWebhookEvent(json, verifyAppKeyWithNeynar);

    // Simpan token & url saat miniapp_added / notifications_enabled
    if (
      (evt.event === "miniapp_added" || evt.event === "notifications_enabled") &&
      evt.notificationDetails
    ) {
      const { token, url } = evt.notificationDetails;
      const fid = evt.fid; // simpan index: fid + client + token
      // TODO: upsert ke DB kamu (Supabase table: notifications(fid, token, url, client))
    }

    // Hapus token saat remove/disable
    if (evt.event === "miniapp_removed" || evt.event === "notifications_disabled") {
      const fid = evt.fid;
      // TODO: delete dari DB by fid/client
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

