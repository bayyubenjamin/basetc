import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/app/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sb = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get("wallet");
    const fid = searchParams.get("fid");

    if (!wallet && !fid) return NextResponse.json({ error: "missing wallet or fid" }, { status: 400 });

    if (wallet) {
      const { data, error } = await sb.from("users").select("*").eq("wallet", wallet.toLowerCase()).maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ user: data ?? null });
    }

    const { data, error } = await sb.from("users").select("*").eq("fid", Number(fid)).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ user: data ?? null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const sb = getSupabaseAdmin();
    const body = await req.json().catch(() => ({}));
    const payload: {
      fid?: number;
      wallet?: string | null;
      username?: string | null;
      display_name?: string | null;
      pfp_url?: string | null;
    } = {};

    if (body.fid !== undefined && body.fid !== null && !Number.isNaN(Number(body.fid))) payload.fid = Number(body.fid);
    if (typeof body.wallet === "string" && body.wallet) payload.wallet = body.wallet.toLowerCase();
    if ("username" in body) payload.username = body.username ?? null;
    if ("display_name" in body) payload.display_name = body.display_name ?? null;
    if ("pfp_url" in body) payload.pfp_url = body.pfp_url ?? null;

    if (!payload.fid && !payload.wallet) return NextResponse.json({ error: "missing fid or wallet" }, { status: 400 });

    if (payload.fid) {
      const { data, error } = await sb.from("users").upsert(
        {
          fid: payload.fid,
          wallet: payload.wallet ?? null,
          username: payload.username ?? null,
          display_name: payload.display_name ?? null,
          pfp_url: payload.pfp_url ?? null,
        },
        { onConflict: "fid" }
      ).select().maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, user: data });
    }

    const { data, error } = await sb.from("users").upsert(
      { wallet: payload.wallet as string },
      { onConflict: "wallet" as any }
    ).select().maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, user: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "server error" }, { status: 500 });
  }
}

