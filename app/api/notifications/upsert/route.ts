// app/api/notifications/upsert/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "https://basetc.xyz",
  "Access-Control-Allow-Methods": "GET,POST,HEAD,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Supabase env missing" }, { status: 500, headers: CORS });
    }
    const supabase = createClient(supabaseUrl, serviceKey);

    const { fid, url, token } = await req.json().catch(() => ({} as any));

    if (!fid || !url || !token) {
      return NextResponse.json({ error: "fid, url, token wajib ada" }, { status: 400, headers: CORS });
    }

    await supabase
      .from("farcaster_tokens")
      .upsert(
        { fid: Number(fid), url: String(url), token: String(token), last_epoch_notified: 0, disabled: false },
        { onConflict: "fid,token" }
      );

    return NextResponse.json({ ok: true }, { status: 200, headers: CORS });
  } catch (e: any) {
    console.error("[UPsert Notif] error:", e?.message || e);
    return NextResponse.json({ error: "upsert-failed" }, { status: 500, headers: CORS });
  }
}

