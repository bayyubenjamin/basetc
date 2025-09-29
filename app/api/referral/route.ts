// app/api/referral/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../lib/supabase/server";
import { rigSaleAddress } from "../../lib/web3Config";
import { ethers } from "ethers";

// Ensures the route is always dynamically rendered and env vars are fresh.
export const dynamic = "force-dynamic";

// GET handler to read referral data. This remains unchanged.
export async function GET(req: NextRequest) {
  const sb = getSupabaseAdmin();
  const { searchParams } = new URL(req.url);
  const inviter = searchParams.get("inviter");
  const detail = searchParams.get("detail");

  if (!inviter) {
    return NextResponse.json({ error: "missing inviter" }, { status: 400 });
  }

  try {
    if (detail) {
      const { data, error } = await sb
        .from("referrals")
        .select("*")
        .eq("inviter", inviter.toLowerCase())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return NextResponse.json({ list: data ?? [] });
    }

    const { data: agg, error } = await sb
      .rpc("claimed_rewards_for", { p_inviter: inviter.toLowerCase() })
      .single();
    if (error) throw error;
    const claimed = (agg as any)?.claimedRewards ?? 0;
    return NextResponse.json({ claimedRewards: Number(claimed) });
  } catch (e: any) {
    return NextResponse.json({ claimedRewards: 0 });
  }
}

/**
 * POST handler for referral actions.
 * - `free-sign`: Generates a signature for a gas-free mint claim.
 * - `mark-valid`: Updates a pending referral to valid after a successful claim.
 * - `touch`: Creates a new pending referral when a user lands from a referral link.
 */
export async function POST(req: NextRequest) {
  try {
    const sb = getSupabaseAdmin();
    const body = await req.json();
    const { mode } = body;

    if (mode === "free-sign") {
      const { fid, to, inviter } = body;
      if (!fid || !to) {
        return NextResponse.json({ error: "Missing fid or to address" }, { status: 400 });
      }

      const deadline = Math.floor(Date.now() / 1000) + 3600; // Signature valid for 1 hour
      const domain = {
        name: process.env.EIP712_NAME || "BaseTC",
        version: process.env.EIP712_VERSION || "1",
        chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID || "84532"),
        verifyingContract: rigSaleAddress,
      };

      const types = {
        FreeClaim: [
          { name: "fid", type: "uint256" }, { name: "to", type: "address" },
          { name: "inviter", type: "address" }, { name: "deadline", type: "uint256" },
        ],
      };

      const value = {
        fid: BigInt(fid),
        to,
        inviter: inviter || ethers.ZeroAddress,
        deadline,
      };

      const pk = process.env.FID_SIGNER_PK;
      if (!pk) {
        console.error("FID_SIGNER_PK is not set in environment variables.");
        return NextResponse.json({ error: "Signer not configured" }, { status: 500 });
      }

      const wallet = new ethers.Wallet(pk);
      const sig = await wallet.signTypedData(domain, types, value);
      const { r, s, v } = ethers.Signature.from(sig);

      return NextResponse.json({ fid, to, inviter: value.inviter, deadline, v, r, s });
    }

    if (mode === "mark-valid") {
      const { inviter, invitee_fid, invitee_wallet } = body;
      if (!inviter || !invitee_fid) {
        return NextResponse.json({ error: "Missing inviter or invitee_fid" }, { status: 400 });
      }

      const { data, error } = await sb
        .from("referrals")
        .update({ status: "valid", invitee_wallet: invitee_wallet ? String(invitee_wallet).toLowerCase() : null })
        .eq("inviter", String(inviter).toLowerCase())
        .eq("invitee_fid", Number(invitee_fid))
        .eq("status", "pending") // Only update pending referrals
        .select()
        .single();
      
      if (error && error.code !== 'PGRST116') { // Ignore "no rows found" error
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, data: data ?? null });
    }

    if (mode === 'touch') {
        const { inviter, invitee_fid } = body;
        if (!inviter || !invitee_fid) {
            return NextResponse.json({ error: 'Missing inviter or invitee_fid for touch' }, { status: 400 });
        }
        await sb.from('referrals').upsert(
            { inviter: String(inviter).toLowerCase(), invitee_fid: Number(invitee_fid), status: 'pending' },
            { onConflict: 'inviter,invitee_fid', ignoreDuplicates: true }
        );
        return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown mode" }, { status: 400 });
  } catch (e: any) {
    console.error("API referral error:", e);
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

