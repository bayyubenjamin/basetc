// app/api/user/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../lib/supabase/server";
import { cookies } from 'next/headers'; // Import cookies dari next/headers

export const dynamic = "force-dynamic";

// Fungsi GET tetap sama, tidak ada perubahan
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

// Fungsi POST dimodifikasi untuk menangani referral
export async function POST(req: NextRequest) {
  try {
    const sb = getSupabaseAdmin();
    const body = await req.json().catch(() => ({}));
    const mode: string | undefined = body?.mode;

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

    const { fid, wallet, username, display_name, pfp_url } = body;
    if (!fid || isNaN(Number(fid))) {
      return NextResponse.json({ error: "fid is required and must be a number" }, { status: 400 });
    }
    const userData: { [key: string]: any } = { fid: Number(fid) };
    if (wallet !== undefined) userData.wallet = wallet ? String(wallet).toLowerCase() : null;
    if (username !== undefined) userData.username = username;
    if (display_name !== undefined) userData.display_name = display_name;
    if (pfp_url !== undefined) userData.pfp_url = pfp_url;

    // 1. Lakukan upsert ke tabel 'users'
    const { data: upsertedUser, error: upsertError } = await sb
      .from("users")
      .upsert(userData, { onConflict: "fid" })
      .select()
      .single();
    if (upsertError) {
      throw new Error(`Failed to upsert user: ${upsertError.message}`);
    }

    // --- LOGIKA REFERRAL BARU ---
    const cookieStore = cookies();
    const fid_ref = cookieStore.get('fid_ref')?.value;
    const inviteeFid = Number(fid);

    // Cek jika ada fid_ref di cookie dan invitee tidak me-refer dirinya sendiri
    if (fid_ref && /^\d+$/.test(fid_ref) && Number(fid_ref) !== inviteeFid) {
        const inviterFid = Number(fid_ref);

        // 2. Dapatkan wallet milik inviter dari tabel 'users'
        const { data: inviterData, error: inviterError } = await sb
            .from("users")
            .select("wallet")
            .eq("fid", inviterFid)
            .maybeSingle();
        
        if (inviterError) {
            console.error('Error fetching inviter wallet:', inviterError.message);
        }

        const inviterWallet = inviterData?.wallet;

        // 3. Jika wallet inviter ditemukan, catat referral di tabel 'referrals'
        if (inviterWallet) {
            const { error: referralError } = await sb
                .from('referrals')
                .upsert({
                    inviter: inviterWallet,
                    invitee_fid: inviteeFid,
                    status: 'pending' // Status awal, akan diubah menjadi 'valid' oleh /api/referral
                }, { onConflict: 'inviter,invitee_fid' });
            
            if (referralError) {
                console.error('Error inserting referral:', referralError.message);
            }
        }
        
        // 4. Hapus cookie setelah diproses agar tidak digunakan lagi
        cookieStore.delete('fid_ref');
    }
    // --- AKHIR LOGIKA REFERRAL ---

    return NextResponse.json({ ok: true, user: upsertedUser });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "server error" }, { status: 500 });
  }
}
