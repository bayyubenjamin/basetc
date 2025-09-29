// app/api/referral/route.ts (potongan POST)

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const supabase = getSupabase();

  // === A) Upsert PENDING referral saat user baru mendarat (Home / dsb) ===
  // body: { action: "touch", inviter, invitee_fid, invitee_wallet? }
  if (body?.action === "touch") {
    const { inviter, invitee_fid, invitee_wallet } = body;
    if (!inviter || !invitee_fid) {
      return NextResponse.json({ error: "missing inviter or invitee_fid" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("referrals")
      .upsert({
        inviter: String(inviter).toLowerCase(),
        invitee_fid: Number(invitee_fid),
        invitee_wallet: invitee_wallet?.toLowerCase?.() ?? null,
        status: "pending",
      }, { onConflict: "invitee_fid" }) // supaya tidak dobel
      .select()
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, referral: data });
  }

  // === B) Update ke VALID setelah user baru sukses claim ===
  // body: { action: "mark-valid", invitee_fid, invitee_wallet? }
  if (body?.action === "mark-valid") {
    const { invitee_fid, invitee_wallet } = body;
    if (!invitee_fid) {
      return NextResponse.json({ error: "missing invitee_fid" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("referrals")
      .update({
        status: "valid",
        invitee_wallet: invitee_wallet?.toLowerCase?.() ?? null,
      })
      .eq("invitee_fid", Number(invitee_fid))
      .select()
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, referral: data });
  }

  return NextResponse.json({ error: "unsupported action" }, { status: 400 });
}

