// app/api/referral/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../lib/supabase/server";
import { rigSaleAddress as rigSaleFromConfig } from "../../lib/web3Config";
import { ethers } from "ethers";

// Render dinamis agar perubahan ENV selalu terambil
export const dynamic = "force-dynamic";

// Helper env with sane defaults (Base Sepolia)
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "84532"); // 84532 = Base Sepolia
const CONTRACT_RIGSALE =
  (process.env.CONTRACT_RIGSALE as `0x${string}`) || (rigSaleFromConfig as `0x${string}`);
const EIP712_NAME = process.env.EIP712_NAME_RIGSALE || "RigSale";
const EIP712_VERSION = process.env.EIP712_VERSION_RIGSALE || "1";
const SIGNER_PK = process.env.FID_SIGNER_PK || process.env.PRIVATE_KEY; // fallback ke PRIVATE_KEY jika perlu

// Validator addr
function normalizeAddr(addr?: string): `0x${string}` {
  if (!addr || !/^0x[0-9a-fA-F]{40}$/.test(addr)) return ethers.ZeroAddress;
  return addr as `0x${string}`;
}

/* ============================
   GET: baca data referral
   ============================ */
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

    // agg function contoh: claimed_rewards_for(p_inviter text)
    const { data: agg, error } = await sb
      .rpc("claimed_rewards_for", { p_inviter: inviter.toLowerCase() })
      .single();
    if (error) throw error;
    const claimed = (agg as any)?.claimedRewards ?? 0;
    return NextResponse.json({ claimedRewards: Number(claimed) });
  } catch {
    return NextResponse.json({ claimedRewards: 0 });
  }
}

/* =========================================================
   POST:
   - free-sign   : buat signature EIP-712 utk claim gratis
   - mark-valid  : tandai referral pending -> valid
   - touch       : buat referral pending saat first-touch
   ========================================================= */
export async function POST(req: NextRequest) {
  try {
    const sb = getSupabaseAdmin();
    const body = await req.json();
    const { mode } = body;

    /* ------------ free-sign ------------ */
    if (mode === "free-sign") {
      const { fid, to, inviter } = body;

      if (!fid || !to) {
        return NextResponse.json(
          { error: "Missing fid or to address" },
          { status: 400 }
        );
      }

      // Normalisasi parameter
      const fidBN = BigInt(fid);
      const toAddr = normalizeAddr(String(to));
      const inviterAddr = normalizeAddr(String(inviter));

      // (Opsional) kamu bisa tambahkan pre-check Supabase di sini
      // untuk enforce mapping FID->wallet sebelum sign.

      // Deadline 1 jam ke depan
      const deadline = Math.floor(Date.now() / 1000) + 3600;

      // Domain EIP-712: gunakan ENV *_RIGSALE + chain Sepolia
      const domain = {
        name: EIP712_NAME,
        version: EIP712_VERSION,
        chainId: CHAIN_ID, // 84532
        verifyingContract: CONTRACT_RIGSALE,
      };

      // Tipe harus cocok dengan kontrak RigSale
      const types = {
        FreeClaim: [
          { name: "fid", type: "uint256" },
          { name: "to", type: "address" },
          { name: "inviter", type: "address" },
          { name: "deadline", type: "uint256" },
        ],
      };

      const value = {
        fid: fidBN,
        to: toAddr,
        inviter: inviterAddr,
        deadline: BigInt(deadline),
      };

      const pk = SIGNER_PK;
      if (!pk) {
        console.error("Missing signer key: set FID_SIGNER_PK or PRIVATE_KEY in env.");
        return NextResponse.json({ error: "Signer not configured" }, { status: 500 });
      }

      // Signer backend (jangan expose ke client)
      const wallet = new ethers.Wallet(pk);
      const sig = await wallet.signTypedData(domain, types as any, value);
      const { r, s, v } = ethers.Signature.from(sig);

      return NextResponse.json({
        fid: Number(fid),
        to: toAddr,
        inviter: inviterAddr,
        deadline,
        v,
        r,
        s,
        // (opsional) kirim balik domain info buat debug client:
        // domain
      });
    }

    /* ------------ mark-valid ------------ */
    if (mode === "mark-valid") {
      const { inviter, invitee_fid, invitee_wallet } = body;
      if (!inviter || !invitee_fid) {
        return NextResponse.json(
          { error: "Missing inviter or invitee_fid" },
          { status: 400 }
        );
      }

      const { data, error } = await sb
        .from("referrals")
        .update({
          status: "valid",
          invitee_wallet: invitee_wallet
            ? String(invitee_wallet).toLowerCase()
            : null,
        })
        .eq("inviter", String(inviter).toLowerCase())
        .eq("invitee_fid", Number(invitee_fid))
        .eq("status", "pending") // hanya update yg pending
        .select()
        .single();

      // PGRST116 = "no rows found" → abaikan (idempotent)
      if (error && error.code !== "PGRST116") {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, data: data ?? null });
    }

    /* ------------ touch ------------ */
    if (mode === "touch") {
      const { inviter, invitee_fid } = body;
      if (!inviter || !invitee_fid) {
        return NextResponse.json(
          { error: "Missing inviter or invitee_fid for touch" },
          { status: 400 }
        );
      }
      await sb.from("referrals").upsert(
        {
          inviter: String(inviter).toLowerCase(),
          invitee_fid: Number(invitee_fid),
          status: "pending",
        },
        { onConflict: "inviter,invitee_fid", ignoreDuplicates: true }
      );
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown mode" }, { status: 400 });
  } catch (e: any) {
    console.error("API referral error:", e);
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}

