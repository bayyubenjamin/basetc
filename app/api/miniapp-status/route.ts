// app/api/miniapp-status/route.ts
import { NextResponse } from "next/server";
import { createAdminClient } from "../../lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const fid = Number(searchParams.get("fid") || 0);
    if (!fid) {
      return NextResponse.json({ added: false, notificationsEnabled: false });
    }

    const supa = createAdminClient();
    const { data, error } = await supa
      .from("basetc_miniapp_installs")
      .select("added, notifications_enabled")
      .eq("fid", fid)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ added: false, notificationsEnabled: false });
    }

    return NextResponse.json({
      added: Boolean(data?.added),
      notificationsEnabled: Boolean(data?.notifications_enabled),
    });
  } catch {
    return NextResponse.json({ added: false, notificationsEnabled: false });
  }
}

