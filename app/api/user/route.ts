// app/api/user/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

function getSB(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE; // server-only
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet = (searchParams.get("wallet") || "").trim().toLowerCase();
  const fidStr = (searchParams.get("fid") || "").trim();

  const sb = getSB();
  if (!sb) {
    // Supabase belum diset → jangan bikin build error
    return NextResponse.json({ user: null, note: "SUPABASE_NOT_CONFIGURED" });
  }

  if (!wallet && !fidStr) {
    return NextResponse.json({ error: "missing wallet or fid" }, { status: 400 });
  }

  if (wallet) {
    const { data, error } = await sb
      .from("users")
      .select("*")
      .ilike("wallet", wallet)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ user: data ?? null });
  }

  const fid = Number(fidStr);
  if (!Number.isFinite(fid)) {
    return NextResponse.json({ error: "invalid fid" }, { status: 400 });
  }
  const { data, error } = await sb
    .from("users")
    .select("*")
    .eq("fid", fid)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ user: data ?? null });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const sb = getSB();
  if (!sb) {
    return NextResponse.json({ error: "SUPABASE_NOT_CONFIGURED" }, { status: 500 });
  }

  const payload = {
    fid: body?.fid ?? null,
    wallet: (body?.wallet ?? null)?.toLowerCase?.() ?? null,
    username: body?.username ?? null,
    display_name: body?.display_name ?? null,
    pfp_url: body?.pfp_url ?? null,
  };

  if (!payload.fid && !payload.wallet) {
    return NextResponse.json({ error: "missing fid or wallet" }, { status: 400 });
  }

  // upsert by unique fid if ada, kalau tidak by wallet (manual upsert)
  let data = null;
  let error = null as any;

  if (payload.fid) {
    ({ data, error } = await sb
      .from("users")
      .upsert(payload, { onConflict: "fid" })
      .select()
      .maybeSingle());
  } else {
    // no fid: coba cari by wallet, insert kalau belum ada
    const found = await sb
      .from("users")
      .select("*")
      .ilike("wallet", payload.wallet!)
      .maybeSingle();
    if (!found.error && found.data) {
      ({ data, error } = await sb
        .from("users")
        .update(payload)
        .eq("id", found.data.id)
        .select()
        .maybeSingle());
    } else {
      ({ data, error } = await sb
        .from("users")
        .insert(payload)
        .select()
        .maybeSingle());
    }
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, user: data });
}

