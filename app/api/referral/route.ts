import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { privateKeyToAccount } from "viem/accounts";
import { rigSaleAddress } from "../../lib/web3Config";

// [FIX] Menggunakan 'require' untuk memastikan 'splitSignature' berhasil diimpor di lingkungan build Vercel.
const { splitSignature } = require("viem");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Helper Supabase (tidak diubah)
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

// Domain EIP-712 (tidak diubah)
const EIP712_DOMAIN = {
  name: "RigSaleFlexible",
  version: "1",
  chainId: 84532, // Base Sepolia
  verifyingContract: rigSaleAddress as `0x${string}`,
};

const types = {
  ClaimRequest: [
    { name: "fid", type: "uint256" },
    { name: "to", type: "address" },
    { name: "inviter", type: "address" },
    // [FIX] Tipe data deadline diperbaiki ke uint256 sesuai standar EVM.
    { name: "deadline", type: "uint256" },
  ],
} as const;

// GET handler (tidak diubah)
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const inviter = searchParams.get("inviter");
    if (!inviter) return NextResponse.json({ error: "missing inviter" }, { status: 400 });

    const supabase = getSupabase();

    const { data: rewardsData, error: rewardsError } = await supabase
        .from('referral_claimed_rewards')
        .select('count')
        .eq('inviter', inviter.toLowerCase())
        .maybeSingle();

    if (rewardsError) return NextResponse.json({ error: rewardsError.message }, { status: 500 });
    
    const { count: validReferrals, error: referralsError } = await supabase
        .from('referrals')
        .select('*', { count: 'exact', head: true })
        .eq('inviter', inviter.toLowerCase())
        .eq('status', 'valid');

    if (referralsError) return NextResponse.json({ error: referralsError.message }, { status: 500 });

    return NextResponse.json({ 
        claimedRewards: rewardsData?.count ?? 0, 
        validReferrals: validReferrals ?? 0 
    });
}

// POST handler (tidak diubah)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const supabase = getSupabase();

  if (body?.mode === "free-sign") {
    const pk = process.env.FID_SIGNER_PK as `0x${string}` | undefined;
    if (!pk) return NextResponse.json({ error: "FID_SIGNER_PK not configured" }, { status: 500 });

    const { fid, to, inviter } = body;
    if (!fid || !to || !inviter) {
      return NextResponse.json({ error: "fid, to, inviter required" }, { status: 400 });
    }

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 15 * 60);
    const message = {
      fid: BigInt(fid),
      to: to as `0x${string}`,
      inviter: inviter as `0x${string}`,
      deadline,
    };

    try {
      const account = privateKeyToAccount(pk);
      const signature = await account.signTypedData({
        domain: EIP712_DOMAIN,
        types,
        primaryType: "ClaimRequest",
        message,
      });
      
      const { v, r, s } = splitSignature(signature);

      return NextResponse.json({ ...message, v: Number(v), r, s, deadline: deadline.toString() });
    } catch (e: any) {
      return NextResponse.json({ error: e.message || "signing failed" }, { status: 500 });
    }
  }

  // Aksi lain (touch, mark-valid, inc) tidak diubah
  if (body?.action === "touch") {
      const { inviter, invitee_fid, invitee_wallet } = body;
      if (!inviter || !invitee_fid) return NextResponse.json({ error: "missing params" }, { status: 400 });
      const { error } = await supabase.from('referrals').upsert({ inviter: String(inviter).toLowerCase(), invitee_fid, invitee_wallet: invitee_wallet ? String(invitee_wallet).toLowerCase() : null, status: 'pending' }, { onConflict: 'invitee_fid' });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
  }

  if (body?.action === "mark-valid") {
      const { invitee_fid, invitee_wallet } = body;
      if (!invitee_fid) return NextResponse.json({ error: "missing invitee_fid" }, { status: 400 });
      const { error } = await supabase.from('referrals').update({ status: 'valid', invitee_wallet: invitee_wallet ? String(invitee_wallet).toLowerCase() : undefined }).eq('invitee_fid', invitee_fid);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
  }
  
  if (body?.inviter && body?.inc) {
      const { inviter, inc } = body;
      const { data, error } = await supabase.rpc('increment_claimed_rewards', { p_inviter: String(inviter).toLowerCase(), p_increment_by: Number(inc) });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, claimedRewards: data });
  }

  return NextResponse.json({ error: "unsupported action or mode" }, { status: 400 });
}


