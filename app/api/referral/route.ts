import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/app/lib/supabase/server";
import { ethers } from "ethers";
import { rigSaleAddress } from "@/app/lib/web3Config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSigner() {
  const pk = process.env.FID_SIGNER_PK;
  const rpc = process.env.RPC_URL;
  const chainId = Number(process.env.CHAIN_ID || 84532);
  if (!pk || !rpc) throw new Error("Missing FID_SIGNER_PK or RPC_URL");
  const provider = new ethers.JsonRpcProvider(rpc, chainId);
  const wallet = new ethers.Wallet(pk, provider);
  return wallet;
}

export async function GET(req: NextRequest) {
  // contoh: /api/referral?inviter=0x...&detail=1
  const sb = getSupabaseAdmin();
  const { searchParams } = new URL(req.url);
  const inviter = searchParams.get("inviter");
  const detail = searchParams.get("detail");
  if (!inviter) return NextResponse.json({ error: "missing inviter" }, { status: 400 });

  if (detail) {
    const { data, error } = await sb.from("referrals").select("*").eq("inviter", inviter.toLowerCase()).order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ list: data ?? [] });
  }

  const { data: agg, error } = await sb.rpc("claimed_rewards_for", { p_inviter: inviter.toLowerCase() }).single().catch(() => ({ data: { claimedRewards: 0 }, error: null }));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ claimedRewards: agg?.claimedrewards ?? agg?.claimedRewards ?? 0 });
}

export async function POST(req: NextRequest) {
  try {
    const sb = getSupabaseAdmin();
    const body = await req.json().catch(() => ({}));

    // A) sentuh referral (pending)
    if (body?.action === "touch") {
      const inviter = String(body.inviter ?? "").toLowerCase();
      const invitee_fid = Number(body.invitee_fid ?? 0);
      if (!/^0x[0-9a-fA-F]{40}$/.test(inviter) || !invitee_fid) {
        return NextResponse.json({ error: "bad params" }, { status: 400 });
      }
      const { data, error } = await sb.from("referrals").upsert(
        { inviter, invitee_fid, status: "pending" },
        { onConflict: "inviter,invitee_fid" as any }
      ).select().maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, row: data });
    }

    // B) mark valid setelah claim sukses
    if (body?.action === "mark-valid") {
      const invitee_fid = Number(body.invitee_fid ?? 0);
      const invitee_wallet = String(body.invitee_wallet ?? "").toLowerCase();
      if (!invitee_fid || !/^0x[0-9a-fA-F]{40}$/.test(invitee_wallet)) {
        return NextResponse.json({ error: "bad params" }, { status: 400 });
      }
      const { data, error } = await sb.from("referrals").update(
        { status: "valid", invitee_wallet }
      ).eq("invitee_fid", invitee_fid).select().maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, row: data });
    }

    // C) klaim hadiah (counter off-chain sementara)
    if (typeof body?.inc === "number" && body?.inviter) {
      const inviter = String(body.inviter).toLowerCase();
      const { data, error } = await sb.rpc("inc_claimed_rewards", { p_inviter: inviter, p_inc: body.inc });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, claimedRewards: data ?? null });
    }

    // D) free-sign: signer EIP-712 untuk claimFreeByFidSig
    if (body?.mode === "free-sign") {
      const fid = BigInt(body.fid);
      const to = String(body.to);
      const inviter = String(body.inviter ?? "0x0000000000000000000000000000000000000000").toLowerCase();
      if (!fid || !/^0x[0-9a-fA-F]{40}$/.test(to)) return NextResponse.json({ error: "bad params" }, { status: 400 });

      const wallet = getSigner();
      const chainId = Number(process.env.CHAIN_ID || 84532);

      const domain = {
        name: process.env.EIP712_NAME || "RigSale",
        version: process.env.EIP712_VERSION || "1",
        chainId,
        verifyingContract: rigSaleAddress as string,
      };

      // sesuaikan type & struct persis dengan kontrak
      const types = {
        ClaimFreeByFid: [
          { name: "fid", type: "uint256" },
          { name: "to", type: "address" },
          { name: "inviter", type: "address" },
          { name: "deadline", type: "uint256" },
        ],
      };

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      const value = { fid, to, inviter, deadline };
      const sigHex = await wallet.signTypedData(domain as any, types as any, value as any);
      const sig = ethers.Signature.from(sigHex);
      return NextResponse.json({
        ok: true,
        fid: String(fid),
        inviter,
        deadline: String(deadline),
        v: sig.v,
        r: sig.r,
        s: sig.s,
      });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "server error" }, { status: 500 });
  }
}

