import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Helper Supabase (tidak diubah)
function getSbAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// [FIXED] GET handler
export async function GET(req: NextRequest) {
  try {
    const sb = getSbAdmin();
    const { searchParams } = new URL(req.url);
    const fid = searchParams.get("fid");
    const wallet = searchParams.get("wallet");

    // Validasi: harus ada salah satu parameter
    if (!fid && !wallet) {
      return NextResponse.json({ error: "fid or wallet parameter is required" }, { status: 400 });
    }

    // Memulai query dengan select()
    let query = sb.from("users").select();

    // Menerapkan filter eq() setelah select()
    if (fid) {
      query = query.eq('fid', fid);
    } else if (wallet) {
      query = query.eq('wallet', String(wallet).toLowerCase());
    }

    // Menjalankan query dan mengambil satu hasil
    const { data, error } = await query.maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json({ error: "user not found" }, { status: 404 });
    }

    return NextResponse.json({ user: data });

  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "server error" }, { status: 500 });
  }
}

// POST handler (tidak diubah, sudah benar)
export async function POST(req: NextRequest) {
  try {
    const sb = getSbAdmin();
    const body = await req.json().catch(() => ({}));

    const payload: any = {};
    if (body.fid) payload.fid = Number(body.fid);
    if (body.wallet) payload.wallet = String(body.wallet).toLowerCase();
    if (typeof body.username !== 'undefined') payload.username = body.username;
    if (typeof body.display_name !== 'undefined') payload.display_name = body.display_name;
    if (typeof body.pfp_url !== 'undefined') payload.pfp_url = body.pfp_url;
    
    if (!payload.fid) {
      return NextResponse.json({ error: "missing fid" }, { status: 400 });
    }

    const { data, error } = await sb
      .from("users")
      .upsert(payload, { onConflict: "fid" })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ ok: true, user: data });

  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "server error" }, { status: 500 });
  }
}


