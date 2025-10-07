// app/api/referral/validate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const sb = getSupabaseAdmin();
    const body = await req.json().catch(() => ({}));

    const inviteeFid = Number(body?.invitee_fid);
    if (!Number.isFinite(inviteeFid) || inviteeFid <= 0) {
      return NextResponse.json({ error: "invitee_fid is required and must be a positive number" }, { status: 400 });
    }

    const rawInviterWallet: string | undefined =
      typeof body?.inviter_wallet === "string" && body.inviter_wallet.startsWith("0x")
        ? body.inviter_wallet.toLowerCase()
        : undefined;

    const inviterFid: number | undefined =
      typeof body?.inviter_fid === "number" && Number.isFinite(body.inviter_fid)
        ? Number(body.inviter_fid)
        : undefined;

    if (!rawInviterWallet && !inviterFid) {
      return NextResponse.json({ error: "either inviter_wallet or inviter_fid is required" }, { status: 400 });
    }

    // resolve inviter
    let inviterUser: { id: string; wallet: string | null } | null = null;
    if (rawInviterWallet) {
      const { data, error } = await sb
        .from("users")
        .select("id, wallet")
        .eq("wallet", rawInviterWallet)
        .maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      inviterUser = (data as any) ?? null;
    } else if (inviterFid) {
      const { data, error } = await sb
        .from("users")
        .select("id, wallet")
        .eq("fid", inviterFid)
        .maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      inviterUser = (data as any) ?? null;
    }

    if (!inviterUser) {
      return NextResponse.json({ error: "inviter user not found" }, { status: 400 });
    }
    if (!inviterUser.wallet) {
      return NextResponse.json({ error: "inviter wallet not found yet" }, { status: 400 });
    }
    const inviterWallet = inviterUser.wallet.toLowerCase();

    // resolve invitee
    const { data: inviteeUser, error: inviteeErr } = await sb
      .from("users")
      .select("id, wallet")
      .eq("fid", inviteeFid)
      .maybeSingle();

    if (inviteeErr) {
      return NextResponse.json({ error: inviteeErr.message }, { status: 500 });
    }
    if (!inviteeUser) {
      return NextResponse.json({ error: "invitee user not found" }, { status: 400 });
    }

    const inviteeId: string = (inviteeUser as any).id;
    const inviteeWallet: string | null = (inviteeUser as any).wallet
      ? String((inviteeUser as any).wallet).toLowerCase()
      : null;

    // pending -> valid
    const { data: updated, error: updErr } = await sb
      .from("referrals")
      .update({
        status: "valid",
        inviter_id: inviterUser.id,
        invitee_id: inviteeId,
        invitee_wallet: inviteeWallet,
      })
      .eq("inviter", inviterWallet)
      .eq("invitee_fid", String(inviteeFid))
      .eq("status", "pending")
      .select();

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    const changed = Array.isArray(updated) ? updated.length : 0;

    return NextResponse.json({
      ok: true,
      updated: changed,
      note: changed === 0 ? "no pending referral row to update (already valid or not found)" : "referral marked as valid",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "server error" }, { status: 500 });
  }
}

