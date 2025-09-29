// app/api/referral/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as sb } from "../../lib/supabase/server";
import { rigSaleAddress } from "../../lib/web3Config";
import { ethers } from "ethers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: baca klaim reward atau detail referral
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const inviter = searchParams.get("inviter");
  const detail = searchParams.get("detail");

  if (!inviter) {
    return NextResponse.json({ error: "missing inviter" }, { status: 400 });
  }

  try {
    if (detail) {
      // daftar referral (pending/valid)
      const { data, error } = await sb
        .from("referrals")
        .select("*")
        .eq("inviter", inviter.toLowerCase())
        .order("created_at", { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ list: data ?? [] });
    }

    // default → agregat claimed rewards via RPC
    const { data: agg, error } = await sb
      .rpc("claimed_rewards_for", { p_inviter: inviter.toLowerCase() })
      .single();

    if (error) {
      // fallback aman
      return NextResponse.json({ claimedRewards: 0 });
    }

    const claimed =
      (agg as any)?.claimedRewards ??
      (agg as any)?.claimedrewards ??
      0;

    return NextResponse.json({ claimedRewards: Number(claimed) });
  } catch (e: any) {
    return NextResponse.json({ claimedRewards: 0 });
  }
}

// POST: untuk free-sign / klaim referral increment
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.mode === "free-sign") {
      const { fid, to, inviter } = body;

      const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 jam
      const domain = {
        name: process.env.EIP712_NAME || "BaseTC",
        version: process.env.EIP712_VERSION || "1",
        chainId: Number(process.env.CHAIN_ID || "84532"),
        verifyingContract: rigSaleAddress,
      };

      const types = {
        FreeClaim: [
          { name: "fid", type: "uint256" },
          { name: "to", type: "address" },
          { name: "inviter", type: "address" },
          { name: "deadline", type: "uint256" },
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
        return NextResponse.json({ error: "Missing signer key" }, { status: 500 });
      }

      const wallet = new ethers.Wallet(pk);
      const sig = await wallet.signTypedData(domain, types, value);
      const r = "0x" + sig.slice(2, 66);
      const s = "0x" + sig.slice(66, 130);
      const v = parseInt(sig.slice(130, 132), 16);

      return NextResponse.json({
        fid,
        inviter,
        deadline,
        v,
        r,
        s,
      });
    }

    if (body.inviter && body.inc) {
      // klaim reward referral increment
      const { inviter } = body;
      const { data, error } = await sb
        .from("referrals")
        .insert({ inviter: inviter.toLowerCase(), status: "valid" })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, claimedRewards: 1, data });
    }

    return NextResponse.json({ error: "Unknown mode" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

