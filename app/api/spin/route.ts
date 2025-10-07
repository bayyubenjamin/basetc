// app/api/spin/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Penting:
 *  - SPIN_MARKET_CLAIM_TYPE harus diset ke claim type yang dipakai market untuk mengurangi remainingQuota.
 *    Misal market pakai "basic_free" → biarkan default; kalau market pakai "rigsale" → set ENV.
 */
const SPIN_MARKET_CLAIM_TYPE = process.env.SPIN_MARKET_CLAIM_TYPE || "basic_free";

/** helper: ambil user by wallet atau fid */
async function getUser(
  sb: ReturnType<typeof getSupabaseAdmin>,
  wallet?: string | null,
  fid?: number | null
) {
  let q = sb.from("users").select("id,fid,wallet").limit(1);
  if (wallet && /^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    q = q.eq("wallet", wallet.toLowerCase());
  } else if (fid && Number.isFinite(fid)) {
    q = q.eq("fid", fid);
  } else {
    return { user: null as any, error: "missing inviter identifier" };
  }
  const { data, error } = await q.maybeSingle();
  if (error) return { user: null, error: error.message };
  return { user: data, error: null };
}

/** helper: panggil /api/referral supaya logicnya 100% ikut market */
async function fetchReferralSummary(inviter: string) {
  // Ketikannya bisa wallet (0x...) atau FID angka; diserahkan apa adanya seperti market
  // Gunakan fetch internal (relative path) agar tidak tergantung origin env
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/referral?inviter=${encodeURIComponent(inviter)}&detail=0`, {
    // Jika NEXT_PUBLIC_BASE_URL kosong (local), fallback ke relative:
    // @ts-ignore - Next runtime akan resolve relative path saat SSR/edge
    next: { revalidate: 0 },
  }).catch(() => null);

  // Fallback ke relative fetch kalau BASE_URL tidak diset
  const res2 = !res
    ? await fetch(`/api/referral?inviter=${encodeURIComponent(inviter)}&detail=0`).catch(() => null)
    : res;

  if (!res2 || !res2.ok) throw new Error("Failed to fetch referral summary");

  const json = await res2.json();
  // Diharapkan shape: { ok, mintMode, validInvites, claimedRewards, remainingQuota }
  if (!json || typeof json.remainingQuota !== "number") {
    throw new Error("Unexpected /api/referral response shape");
  }
  return json as {
    ok: boolean;
    mintMode?: string;
    validInvites: number;
    claimedRewards: number;
    remainingQuota: number;
  };
}

/** GET /api/spin?inviter=<wallet|fid> → sinkron dengan market */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const inviterParam = url.searchParams.get("inviter");
    if (!inviterParam) {
      return NextResponse.json({ error: "missing inviter param" }, { status: 400 });
    }

    // langsung proxy: ikut /api/referral (market)
    const ref = await fetchReferralSummary(inviterParam);

    return NextResponse.json({
      ok: true,
      // samakan istilah agar jelas di UI spin
      remainingSpins: ref.remainingQuota,
      validInvites: ref.validInvites,
      claimedSpins: ref.claimedRewards,
      bonusPerInvite: 1,         // mengikuti market (1 reward per valid invite). Jika market berubah, /api/referral tetap kebenaran tunggal.
      mintMode: ref.mintMode ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "server error" }, { status: 500 });
  }
}

/** POST /api/spin
 *  body: { wallet?: string; fid?: number; count: number }
 *  → insert claims pakai type yang dipakai market supaya pool berkurang di market & spin sekaligus.
 */
export async function POST(req: NextRequest) {
  try {
    const sb = getSupabaseAdmin();
    const body = await req.json().catch(() => ({}));

    const count = Number(body?.count);
    if (!Number.isFinite(count) || count <= 0) {
      return NextResponse.json({ error: "count must be positive integer" }, { status: 400 });
    }

    // identifikasi user (inviter)
    const wallet: string | undefined =
      typeof body?.wallet === "string" && body.wallet.startsWith("0x")
        ? body.wallet.toLowerCase()
        : undefined;

    const fid: number | undefined =
      typeof body?.fid === "number" && Number.isFinite(body.fid)
        ? Number(body.fid)
        : undefined;

    const { user, error } = await getUser(sb, wallet, fid);
    if (error || !user) {
      return NextResponse.json({ error: error ?? "inviter not found" }, { status: 400 });
    }
    if (!user.wallet) {
      return NextResponse.json({ error: "inviter wallet not found yet" }, { status: 400 });
    }

    // cek quota dari /api/referral biar sama persis dengan market
    const inviterForReferral = wallet ?? String(fid); // param bisa wallet atau fid (market harus sudah dukung keduanya)
    const ref = await fetchReferralSummary(inviterForReferral);
    const available = Math.max(0, ref.remainingQuota);

    if (count > available) {
      return NextResponse.json(
        {
          error: "insufficient spins",
          detail: {
            requested: count,
            available,
            validInvites: ref.validInvites,
            claimedSpins: ref.claimedRewards,
            mintMode: ref.mintMode ?? null,
          },
        },
        { status: 400 }
      );
    }

    // catat claim dengan TYPE yang sama dengan market (supaya pool turun di dua tempat)
    const { data, error: insErr } = await sb
      .from("claims")
      .insert({
        inviter: user.wallet,        // TEXT untuk konsistensi
        inviter_id: user.id,         // FK → users
        type: SPIN_MARKET_CLAIM_TYPE, // <— SANGAT PENTING: selaraskan dengan market
        amount: count,
      })
      .select()
      .single();

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    // hitung ulang via /api/referral setelah insert? bisa, tapi mahal; cukup prediksi di sisi server:
    const remainingAfter = available - count;

    return NextResponse.json({
      ok: true,
      claimed: count,
      claim: data,
      remainingSpins: remainingAfter,
      mirror: {
        // ini memudahkan debugging vs market
        marketRemainingQuotaBefore: available,
        marketValidInvites: ref.validInvites,
        marketClaimedBefore: ref.claimedRewards,
        claimTypeUsed: SPIN_MARKET_CLAIM_TYPE,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "server error" }, { status: 500 });
  }
}

