import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// --- Supabase client (service role, server-only)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

// Helpers
async function getClaimed(inviter: string): Promise<number> {
  const { data, error } = await supabase
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

async function incClaimed(inviter: string, inc = 1): Promise<number> {
  const addr = inviter.toLowerCase();
  const existing = await getClaimed(addr);
  const next = existing + (Number(inc) || 0);
  const { error } = await supabase
    .from("invite_claims")
    .upsert({ inviter: addr, claimed: next }, { onConflict: "inviter" });
  if (error) {
    console.error("supabase incClaimed error:", error);
    throw new Error("DB error");
  }
  return next;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const inviter = (searchParams.get("inviter") || "").trim();
  if (!inviter) {
    return NextResponse.json({ error: "missing inviter" }, { status: 400 });
  }
  const claimedRewards = await getClaimed(inviter);
  return NextResponse.json({ claimedRewards });
}

// ====== POST: increment claimed OR sign free-mint ======
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  // 1) increment claimed: { inviter, inc }
  if (body?.inviter && body?.inc) {
    const next = await incClaimed(body.inviter, body.inc);
    return NextResponse.json({ ok: true, claimedRewards: next });
  }

  // 2) (optional) sign free-mint user baru via EIP-712:
  // body: { mode: "free-sign", fid, to, inviter }
  if (body?.mode === "free-sign") {
    const { fid, to, inviter } = body;
    if (!fid || !to) {
      return NextResponse.json({ error: "missing fid/to" }, { status: 400 });
    }

    // TODO: SESUAIKAN typed-data dgn kontrakmu.
    // Kamu perlu tahu "name", "version", chainId, verifyingContract, dan struct types.
    // Di bawah ini hanya contoh *placeholder* struktur payload.
    // Lengkapi lalu tandatangani pakai private key signer (FID_SIGNER_PK) di server.
    const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 jam
    const payload = {
      fid: String(fid),
      to,
      inviter: inviter || "0x0000000000000000000000000000000000000000",
      deadline
    };

    // Contoh balikan (tanpa tanda tangan dulu):
    // Setelah kamu isi EIP-712 real, balikan { v,r,s } sesuai.
    return NextResponse.json({
      ...payload,
      // v,r,s: "ISI_DARI_SIGNER",
      note: "Isi proses EIP-712 signing sesuai kontrak RigSaleFlexible kamu."
    });
  }

  return NextResponse.json({ error: "unsupported body" }, { status: 400 });
}

