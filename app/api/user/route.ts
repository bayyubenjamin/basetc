// app/api/user/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

/* =========================
   GET
   ========================= */
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
      const n = Number(fid);
      if (!n || Number.isNaN(n)) {
        return NextResponse.json({ error: "invalid fid" }, { status: 400 });
      }
      query = query.eq("fid", n);
    }

    const { data, error } = await query.maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ user: data ?? null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "server error" }, { status: 500 });
  }
}

/* =========================
   POST
   Body: { fid?: number, wallet?: string, ... }
   ========================= */
export async function POST(req: NextRequest) {
  const sb = getSupabaseAdmin();

  try {
    const body = await req.json().catch(() => ({}));
    const mode: string | undefined = body?.mode;

    // --- MODE 1: CEK WALLET BY FID (Logic Lama) ---
    if (mode === "get_wallet_by_fid") {
      const fid = Number(body?.fid);
      if (!fid || Number.isNaN(fid)) {
        return NextResponse.json({ error: "fid is required" }, { status: 400 });
      }
      const { data, error } = await sb
        .from("users")
        .select("wallet")
        .eq("fid", fid)
        .maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, wallet: data?.wallet ?? null });
    }

    // --- MODE 2: CREATE / UPDATE USER (Hybrid Logic) ---
    const { fid, wallet, username, display_name, pfp_url } = body;
    
    // Validasi: Minimal harus ada FID ATAU Wallet
    const inviteeFidNum = fid ? Number(fid) : null;
    const inviteeWalletStr = wallet ? String(wallet).toLowerCase() : null;

    if (!inviteeFidNum && !inviteeWalletStr) {
      return NextResponse.json({ error: "Either FID or Wallet is required" }, { status: 400 });
    }

    // Siapkan Data User
    const userData: Record<string, any> = {};
    if (inviteeFidNum) userData.fid = inviteeFidNum;
    if (inviteeWalletStr) userData.wallet = inviteeWalletStr;
    if (username !== undefined) userData.username = username;
    if (display_name !== undefined) userData.display_name = display_name;
    if (pfp_url !== undefined) userData.pfp_url = pfp_url;

    // Eksekusi Upsert dengan Strategi Konflik yang Benar
    // FIX: Memisahkan eksekusi query ke variabel 'upsertResult' agar TypeScript tidak bingung tipe datanya.
    let upsertResult;

    if (inviteeFidNum) {
        // JALUR FARCASTER: Conflict di 'fid' (Menjaga user lama)
        upsertResult = await sb
            .from("users")
            .upsert(userData, { onConflict: "fid" })
            .select()
            .single();
    } else {
        // JALUR BASE APP: Conflict di 'wallet' (User baru tanpa FID)
        upsertResult = await sb
            .from("users")
            .upsert(userData, { onConflict: "wallet" })
            .select()
            .single();
    }

    const { data: upsertedUser, error: upErr } = upsertResult;
    
    if (upErr) throw new Error(`Failed to upsert user: ${upErr.message}`);

    const inviteeId: string | null = upsertedUser?.id ?? null;
    // Gunakan wallet dari hasil DB, atau fallback ke input
    const finalInviteeWallet: string | null = 
        (upsertedUser?.wallet ? String(upsertedUser.wallet).toLowerCase() : null) ?? inviteeWalletStr;

    const res = NextResponse.json({ ok: true, user: upsertedUser });

    /* =========================
       REFERRAL HYBRID
       ========================= */
    const cookieStore = cookies();
    const fid_ref_body = body?.fid_ref ? String(body.fid_ref).trim() : undefined;
    const fid_ref_cookie = cookieStore.get("fid_ref")?.value;
    const fidRef = fid_ref_body ?? fid_ref_cookie;

    if (fidRef) {
      const inviterFid = Number(fidRef);
      // Validasi: Jangan invite diri sendiri
      const isSelfInvite = inviteeFidNum && inviteeFidNum === inviterFid;

      if (Number.isFinite(inviterFid) && inviterFid > 0 && !isSelfInvite) {
        // Cari Inviter
        const { data: inviterUser } = await sb
          .from("users")
          .select("id, wallet")
          .eq("fid", inviterFid)
          .maybeSingle();

        const inviterWallet = inviterUser?.wallet ? String(inviterUser.wallet).toLowerCase() : null;
        const inviterId = inviterUser?.id ?? null;

        if (inviterWallet) {
          const referralPayload: Record<string, any> = {
            inviter: inviterWallet,
            status: "pending",
            invitee_wallet: finalInviteeWallet,
            inviter_id: inviterId,
            invitee_id: inviteeId,
          };

          // Handle FID NULLABLE
          if (inviteeFidNum) {
             referralPayload.invitee_fid = String(inviteeFidNum);
          } else {
             referralPayload.invitee_fid = null; // Pastikan kolom DB 'invitee_fid' nullable
          }

          const { error: refErr } = await sb
            .from("referrals")
            .upsert(referralPayload, { 
                // Jika pakai constraint, sesuaikan. Defaultnya upsert akan update jika kena constraint.
                onConflict: inviteeFidNum ? "inviter,invitee_fid" : undefined 
            });
            
          if (refErr) console.error("Error upserting referral:", refErr.message);

          // Trigger Validate Now (Hanya jika user punya FID, sesuai logic lama)
          if (body?.validate_referral_now === true && inviteeFidNum) {
             await triggerValidation(req, inviterWallet, inviteeFidNum);
          }
        }
      }
    }

    res.cookies.set("fid_ref", "", { path: "/", expires: new Date(0) });
    return res;

  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "server error" }, { status: 500 });
  }
}

async function triggerValidation(req: NextRequest, inviterWallet: string, inviteeFid: number) {
    try {
        const proto = req.headers.get("x-forwarded-proto") ?? "https";
        const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
        const baseUrl = host ? `${proto}://${host}` : process.env.NEXT_PUBLIC_BASE_URL ?? "";
        
        await fetch(`${baseUrl}/api/referral/validate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inviter_wallet: inviterWallet, invitee_fid: inviteeFid }),
          cache: "no-store",
        });
    } catch (err) {
        console.error("Referral validation call failed:", err);
    }
}
