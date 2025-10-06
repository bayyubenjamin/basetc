// app/api/user/route.ts
//
// This updated route adds a new `mode` to the POST handler so that
// clients can retrieve a user's wallet address given their Farcaster
// ID (FID). When `mode: "get_wallet_by_fid"` is supplied in the
// request body along with a numeric `fid`, the route will query
// Supabase and return `{ ok: true, wallet: <string|null> }`. If the
// mode is not provided, the route behaves as before, upserting the
// user record based on the provided fields.

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../lib/supabase/server";

// Ensure this route is always executed on the server so that
// environment variables are current on each invocation.
export const dynamic = "force-dynamic";

/**
 * GET handler to fetch a user by wallet or FID.  Clients can call
 * `/api/user?wallet=0x...` or `/api/user?fid=1234` and receive the
 * matching row from the `users` table. If neither parameter is
 * provided, the handler returns a 400 error.
 */
export async function GET(req: NextRequest) {
  try {
    const sb = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get("wallet");
    const fid = searchParams.get("fid");

    if (!wallet && !fid) {
      return NextResponse.json({ error: "missing wallet or fid" }, { status: 400 });
    }

    let query = sb.from("users").select("*");
    if (wallet) {
      query = query.eq("wallet", wallet.toLowerCase());
    } else if (fid) {
      query = query.eq("fid", Number(fid));
    }

    const { data, error } = await query.maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ user: data ?? null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "server error" }, { status: 500 });
  }
}

/**
 * POST handler. By default, this handler upserts a user row using
 * fields supplied in the body. Only `fid` is required for the
 * upsert. Other fields (`wallet`, `username`, `display_name`,
 * `pfp_url`) are optional.  When the body contains
 * `{ mode: "get_wallet_by_fid", fid: <number> }`, the handler
 * performs a lookup on the `users` table and returns the wallet
 * associated with that FID instead of performing an upsert.
 */
export async function POST(req: NextRequest) {
  try {
    const sb = getSupabaseAdmin();
    const body = await req.json().catch(() => ({}));
    const mode: string | undefined = body?.mode;

    // Mode to fetch a wallet by FID without upserting a user.
    if (mode === "get_wallet_by_fid") {
      const fid = Number(body?.fid);
      if (!fid || Number.isNaN(fid)) {
        return NextResponse.json({ error: "fid is required and must be a number" }, { status: 400 });
      }
      const { data, error } = await sb.from("users").select("wallet").eq("fid", fid).maybeSingle();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, wallet: data?.wallet ?? null });
    }

    // Upsert behaviour: create or update a user row. FID is required.
    const { fid, wallet, username, display_name, pfp_url } = body;
    if (!fid || isNaN(Number(fid))) {
      return NextResponse.json({ error: "fid is required and must be a number" }, { status: 400 });
    }
    const userData: { [key: string]: any } = { fid: Number(fid) };
    if (wallet !== undefined) userData.wallet = wallet ? String(wallet).toLowerCase() : null;
    if (username !== undefined) userData.username = username;
    if (display_name !== undefined) userData.display_name = display_name;
    if (pfp_url !== undefined) userData.pfp_url = pfp_url;

    const { data, error } = await sb
      .from("users")
      .upsert(userData, { onConflict: "fid" })
      .select()
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, user: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "server error" }, { status: 500 });
  }
}
