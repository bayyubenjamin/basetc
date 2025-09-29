// app/api/user/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../lib/supabase/server";

// Ensures the route is always dynamically rendered, reading the latest environment variables on Vercel.
export const dynamic = "force-dynamic";

// GET handler to fetch user data by wallet or FID. This remains unchanged.
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
 * POST handler to create or update a user (upsert).
 * This is used for auto-saving Farcaster profiles on app load
 * and for mapping wallets to FIDs when a user connects.
 * It securely uses the Supabase admin client.
 */
export async function POST(req: NextRequest) {
  try {
    const sb = getSupabaseAdmin();
    const body = await req.json().catch(() => ({}));

    // Only FID is required for an upsert. Other fields are optional.
    const { fid, wallet, username, display_name, pfp_url } = body;

    if (!fid || isNaN(Number(fid))) {
      return NextResponse.json({ error: "fid is required and must be a number" }, { status: 400 });
    }

    const userData: { [key: string]: any } = { fid: Number(fid) };

    // Build the user data object only with the fields that are present in the request.
    // This allows for partial updates (e.g., just adding a wallet to an existing FID).
    if (wallet !== undefined) userData.wallet = wallet ? String(wallet).toLowerCase() : null;
    if (username !== undefined) userData.username = username;
    if (display_name !== undefined) userData.display_name = display_name;
    if (pfp_url !== undefined) userData.pfp_url = pfp_url;

    // Perform the upsert operation. If a user with the given FID exists, it will be updated.
    // Otherwise, a new user will be created.
    const { data, error } = await sb
      .from("users")
      .upsert(userData, { onConflict: "fid" })
      .select()
      .single();

    if (error) {
      console.error('Supabase user upsert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, user: data });
  } catch (e: any) {
    console.error('API user route error:', e);
    return NextResponse.json({ error: e?.message || "server error" }, { status: 500 });
  }
}

