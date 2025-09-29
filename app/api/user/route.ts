import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSbAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE; // Wajib service role (server-side)
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * GET /api/user?wallet=0x...  -> cari user by wallet
 * GET /api/user?fid=12345     -> cari user by fid
 */
export async function GET(req: NextRequest) {
  try {
    const sb = getSbAdmin();
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get("wallet");
    const fid = searchParams.get("fid");

    if (!wallet && !fid) {
      return NextResponse.json({ error: "missing wallet or fid" }, { status: 400 });
    }

    if (wallet) {
      const { data, error } = await sb
        .from("users")
        .select("*")
        .eq("wallet", wallet.toLowerCase())
        .maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ user: data ?? null });
    }

    const { data, error } = await sb
      .from("users")
      .select("*")
      .eq("fid", Number(fid))
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ user: data ?? null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "server error" }, { status: 500 });
  }
}

/**
 * POST /api/user
 * body dapat salah satu skenario:
 *  - { fid, username?, display_name?, pfp_url?, wallet? }  -> upsert by fid
 *  - { wallet, fid? }                                     -> upsert by fid jika ada, kalau tidak hanya set wallet (fallback)
 */
export async function POST(req: NextRequest) {
  try {
    const sb = getSbAdmin();
    const body = await req.json().catch(() => ({}));

    // Normalisasi input
    const payload: {
      fid?: number;
      wallet?: string | null;
      username?: string | null;
      display_name?: string | null;
      pfp_url?: string | null;
    } = {};

    if (typeof body.fid !== "undefined" && body.fid !== null && !Number.isNaN(Number(body.fid))) {
      payload.fid = Number(body.fid);
    }
    if (typeof body.wallet === "string" && body.wallet) {
      payload.wallet = body.wallet.toLowerCase();
    }
    if (typeof body.username !== "undefined") payload.username = body.username ?? null;
    if (typeof body.display_name !== "undefined") payload.display_name = body.display_name ?? null;
    if (typeof body.pfp_url !== "undefined") payload.pfp_url = body.pfp_url ?? null;

    // Minimal harus ada fid ATAU wallet
    if (!payload.fid && !payload.wallet) {
      return NextResponse.json({ error: "missing fid or wallet" }, { status: 400 });
    }

    // Upsert by fid kalau ada fid
    if (payload.fid) {
      const { data, error } = await sb
        .from("users")
        .upsert(
          {
            fid: payload.fid,
            wallet: payload.wallet ?? null,
            username: payload.username ?? null,
            display_name: payload.display_name ?? null,
            pfp_url: payload.pfp_url ?? null,
          },
          { onConflict: "fid" }
        )
        .select()
        .maybeSingle();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, user: data });
    }

    // Kalau tidak ada fid (jarang, tapi jaga-jaga), kita upsert by wallet saja.
    const { data, error } = await sb
      .from("users")
      .upsert(
        {
          wallet: payload.wallet as string,
        },
        { onConflict: "wallet" as any } // jika belum ada unique, ga masalah; upsert akan tetap insert/update
      )
      .select()
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, user: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "server error" }, { status: 500 });
  }
}

