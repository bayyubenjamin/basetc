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
 * POST handler to create or update a user (upsert) and resolve wallet (get_wallet_by_fid).
 */
export async function POST(req: NextRequest) {
  try {
    const sb = getSupabaseAdmin();
    const body = await req.json().catch(() => ({}));
    const mode = body?.mode || "upsert";

    if (mode === "get_wallet_by_fid") {
        if (!body.fid || isNaN(Number(body.fid))) {
            return NextResponse.json({ error: "fid is required and must be a number" }, { status: 400 });
        }
        const { data, error } = await sb
            .from("users")
            .select("wallet")
            .eq("fid", Number(body.fid))
            .maybeSingle();
        
        if (error) {
            console.error('Supabase get wallet error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        
        // Memastikan wallet ada dan bukan null
        if (!data || !data.wallet) {
             return NextResponse.json({ ok: false, error: "Wallet not found for this FID" }, { status: 404 });
        }

        return NextResponse.json({ ok: true, wallet: data.wallet });
    }

    // --- Logika Upsert (Default) ---
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
      console.error('Supabase user upsert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, user: data });
  } catch (e: any) {
    console.error('API user route error:', e);
    return NextResponse.json({ error: e?.message || "server error" }, { status: 500 });
  }
}
