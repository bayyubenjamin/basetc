// app/api/referral/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

// --- Lazy init Supabase biar gak crash waktu build
function getSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function getClaimed(inviter: string): Promise<number> {
  const sp = getSupabase();
  if (!sp) return 0; // fallback aman kalau env belum siap
  const { data, error } = await sp
    .from("invite_claims")
    .select("claimed")
    .eq("inviter", inviter.toLowerCase())
    .maybeSingle();
  if (error) {
    console.error("supabase getClaimed error:", error);
    return 0;
  }
  return data?.claimed ?? 0;
}

async function incClaimed(inviter: string, inc = 1): Promise<{ ok: boolean; claimedRewards?: number; error?: string; }> {
  const sp = getSupabase();
  if (!sp) return { ok: false, error: "SUPABASE_NOT_CONFIGURED" };
  const addr = inviter.toLowerCase();
  const prev = await getClaimed(addr);
  const next = prev + (Number(inc) || 0);
  const { error } = await sp
    .from("invite_claims")
    .upsert({ inviter: addr, claimed: next }, { onConflict: "inviter" });
  if (error) {
    console.error("supabase incClaimed error:", error);
    return { ok: false, error: "DB_ERROR" };
  }
  return { ok: true, claimedRewards: next };
}

// GET /api/referral?inviter=0x...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const inviter = (searchParams.get("inviter") || "").trim();
  if (!inviter) {
    return NextResponse.json({ error: "missing inviter" }, { status: 400 });
  }
  const claimedRewards = await getClaimed(inviter);
  return NextResponse.json({ claimedRewards });
}

// POST /api/referral
// 1) { inviter, inc } -> increment claimed
// 2) { mode: "free-sign", fid, to, inviter } -> stub signer EIP-712 (isi nanti)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  // increment claimed
  if (body?.inviter && body?.inc) {
    const res = await incClaimed(body.inviter, body.inc);
    if (!res.ok) {
      // kalau supabase belum diset, balikin pesan jelas (tanpa bikin build error)
      return NextResponse.json(res, { status: 500 });
    }
    return NextResponse.json({ ok: true, claimedRewards: res.claimedRewards });
  }

  // stub signer EIP-712 (lengkapi nanti)
  if (body?.mode === "free-sign") {
    const { fid, to, inviter } = body;
    if (!fid || !to) {
      return NextResponse.json({ error: "missing fid/to" }, { status: 400 });
    }
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    // TODO: isi domain, types, dan signing pakai FID_SIGNER_PK
    return NextResponse.json({
      fid,
      to,
      inviter: inviter || "0x0000000000000000000000000000000000000000",
      deadline,
      note: "Signer EIP-712 belum diaktifkan. Lengkapi domain/types+signer lalu kirim v,r,s.",
    });
  }

  return NextResponse.json({ error: "unsupported body" }, { status: 400 });
}

