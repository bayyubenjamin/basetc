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
   Body:
   { fid: number, wallet?: string, username?: string, display_name?: string, pfp_url?: string, fid_ref?: string, validate_referral_now?: boolean }
   atau { mode: "get_wallet_by_fid", fid: number }
   ========================= */
export async function POST(req: NextRequest) {
  const sb = getSupabaseAdmin();

  try {
    const body = await req.json().catch(() => ({}));
    const mode: string | undefined = body?.mode;

    // helper: ambil wallet by fid
    if (mode === "get_wallet_by_fid") {
      const fid = Number(body?.fid);
      if (!fid || Number.isNaN(fid)) {
        return NextResponse.json({ error: "fid is required and must be a number" }, { status: 400 });
      }
      const { data, error } = await sb
        .from("users")
        .select("wallet")
        .eq("fid", fid)
        .maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, wallet: data?.wallet ?? null });
    }

    // Upsert user (fid wajib)
    const { fid, wallet, username, display_name, pfp_url } = body;
    const inviteeFidNum = Number(fid);
    if (!inviteeFidNum || Number.isNaN(inviteeFidNum)) {
      return NextResponse.json({ error: "fid is required and must be a number" }, { status: 400 });
    }

    const userData: Record<string, any> = { fid: inviteeFidNum };
    if (wallet !== undefined) userData.wallet = wallet ? String(wallet).toLowerCase() : null;
    if (username !== undefined) userData.username = username;
    if (display_name !== undefined) userData.display_name = display_name;
    if (pfp_url !== undefined) userData.pfp_url = pfp_url;

    const { data: upsertedUser, error: upErr } = await sb
      .from("users")
      .upsert(userData, { onConflict: "fid" })
      .select()
      .single();
    if (upErr) throw new Error(`Failed to upsert user: ${upErr.message}`);

    // ambil id & wallet invitee (hasil upsert)
    const inviteeId: string | null = upsertedUser?.id ?? null;
    const inviteeWallet: string | null =
      (upsertedUser?.wallet ? String(upsertedUser.wallet).toLowerCase() : null) ??
      (userData.wallet ? String(userData.wallet).toLowerCase() : null) ??
      null;

    // siapkan response (supaya bisa hapus cookie via header)
    const res = NextResponse.json({ ok: true, user: upsertedUser });

    /* =========================
       REFERRAL (prioritaskan body, abaikan cookie kosong)
       - inviter TEXT (wallet)
       - invitee_fid TEXT
       ========================= */
    const cookieStore = cookies();

    // Konversi fid_ref dari body ke string dan pastikan hanya berisi digit.
    const fid_ref_body_raw = body?.fid_ref;
    let fid_ref_body: string | undefined = undefined;
    if (fid_ref_body_raw !== undefined) {
      const str = String(fid_ref_body_raw).trim();
      if (/^\d+$/.test(str)) fid_ref_body = str;
    }

    // Ambil fid_ref dari cookie. Abaikan jika kosong atau hanya whitespace.
    const rawCookie = cookieStore.get("fid_ref")?.value;
    const fid_ref_cookie = rawCookie && rawCookie.trim().length > 0 ? rawCookie : undefined;

    // Gunakan body terlebih dahulu; jika tidak ada, gunakan cookie.
    const fidRef = fid_ref_body ?? fid_ref_cookie;

    // variabel ini akan dipakai juga untuk optional "validate_referral_now"
    let inviterWalletForValidate: string | null = null;

    if (fidRef) {
      const inviterFid = Number(fidRef);

      if (Number.isFinite(inviterFid) && inviterFid > 0 && inviterFid !== inviteeFidNum) {
        // cari inviter by FID → wallet & id
        const { data: inviterUser, error: inviterErr } = await sb
          .from("users")
          .select("id, wallet")
          .eq("fid", inviterFid)
          .maybeSingle();
        if (inviterErr) console.error("Error fetching inviter:", inviterErr.message);

        const inviterWallet: string | null = inviterUser?.wallet
          ? String(inviterUser.wallet).toLowerCase()
          : null;
        const inviterId: string | null = inviterUser?.id ?? null;

        inviterWalletForValidate = inviterWallet ?? null;

        if (inviterWallet) {
          const payload: Record<string, any> = {
            inviter: inviterWallet,              // TEXT (PK part #1)
            invitee_fid: String(inviteeFidNum),  // TEXT (PK part #2)
            status: "pending",
            invitee_wallet: inviteeWallet ?? null,
            inviter_id: inviterId ?? null,
            invitee_id: inviteeId ?? null,
          };

          const { error: refErr } = await sb
            .from("referrals")
            .upsert(payload, { onConflict: "inviter,invitee_fid" });
          if (refErr) console.error("Error upserting referral:", refErr.message);
        } else {
          // inviter belum punya wallet -> tidak bisa insert karena PK butuh inviter (TEXT)
          console.warn("[referral] inviter wallet not found yet for fid", inviterFid);
        }
      }
    }

    /* ============================================
       OPTIONAL TRIGGER: validate referral now
       Gunakan ini SETELAH "free new user claim" benar2 sukses.
       Cara pakai dari client/miniapp:
       fetch('/api/user', { method:'POST', body: { fid, validate_referral_now:true } })
       (pastikan fid_ref sudah terdeteksi sebelumnya)
       ============================================ */
    if (body?.validate_referral_now === true && inviterWalletForValidate) {
      try {
        // bangun absolute base url agar aman di serverless/edge
        const proto = req.headers.get("x-forwarded-proto") ?? "https";
        const host =
          req.headers.get("x-forwarded-host") ??
          req.headers.get("host") ??
          process.env.NEXT_PUBLIC_BASE_HOST ??
          "";
        const baseUrlEnv = process.env.NEXT_PUBLIC_BASE_URL ?? "";
        const baseUrl = host ? `${proto}://${host}` : baseUrlEnv;
        const endpoint = baseUrl ? `${baseUrl}/api/referral/validate` : "/api/referral/validate";

        await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inviter_wallet: inviterWalletForValidate,
            invitee_fid: inviteeFidNum,
          }),
          // jangan cache
          cache: "no-store",
        });
      } catch (err) {
        console.error("Referral validation call failed:", err);
      }
    }

    // Hapus cookie via response (atur tanggal kedaluwarsa ke masa lalu)
    res.cookies.set("fid_ref", "", { path: "/", expires: new Date(0) });

    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "server error" }, { status: 500 });
  }
}

