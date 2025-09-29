import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { privateKeyToAccount } from "viem/accounts";
import { isAddress, splitSignature } from "viem";

// Impor alamat kontrak dari konfigurasi terpusat Anda.
// Pastikan path ini benar sesuai struktur proyek Anda.
import { rigSaleAddress } from "../../lib/web3Config";

// [FIX 1] Paksa route menjadi dinamis untuk memastikan environment variables selalu terbaca.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Helper function terpusat untuk koneksi Supabase sebagai admin.
 */
function getSbAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Server Error: Missing Supabase admin credentials.");
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// [FIX 2] Konfigurasi EIP-712.
// Data ini HARUS SAMA PERSIS dengan yang ada di konstruktor smart contract `RigSale.sol`.
// Perbedaan sekecil apapun akan menyebabkan signature ditolak oleh kontrak.
const EIP712_DOMAIN = {
  name: "RigSaleFlexible", // Nama kontrak atau domain
  version: "1",             // Versi signature
  chainId: 84532,           // ID Chain (Base Sepolia)
  verifyingContract: rigSaleAddress as `0x${string}`,
};

// Mendefinisikan struktur data yang akan ditandatangani.
// Nama field ('fid', 'to', 'inviter', 'deadline') dan tipe ('uint256', 'address')
// HARUS SAMA PERSIS dengan struct `ClaimRequest` di dalam kontrak.
const EIP712_TYPES = {
  ClaimRequest: [
    { name: "fid", type: "uint256" },
    { name: "to", type: "address" },
    { name: "inviter", type: "address" },
    { name: "deadline", type: "uint256" },
  ],
} as const;


/**
 * Handler GET: Mengambil data statistik referral untuk seorang inviter.
 * Misalnya: jumlah referral yang valid dan jumlah reward yang sudah diklaim.
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const inviter = searchParams.get("inviter");

        if (!inviter || !isAddress(inviter)) {
            return NextResponse.json({ error: "inviter address is required and must be valid" }, { status: 400 });
        }

        const sb = getSbAdmin();
        
        // Ambil total referral yang valid
        const { count: validReferrals, error: referralsError } = await sb
            .from('referrals')
            .select('*', { count: 'exact', head: true })
            .eq('inviter', inviter.toLowerCase())
            .eq('status', 'valid');
        
        if (referralsError) throw referralsError;

        // Ambil total reward yang sudah diklaim (jika ada tabelnya)
        const { data: claimedData, error: claimedError } = await sb
            .from('referral_claimed_rewards')
            .select('count')
            .eq('inviter', inviter.toLowerCase())
            .maybeSingle();

        if (claimedError) throw claimedError;

        return NextResponse.json({
            validReferrals: validReferrals ?? 0,
            claimedRewards: claimedData?.count ?? 0,
        });

    } catch (e: any) {
        console.error("GET /api/referral Error:", e);
        return NextResponse.json({ error: e.message || "An unexpected error occurred" }, { status: 500 });
    }
}


/**
 * Handler POST: Menangani semua aksi terkait referral (signing, touch, mark-valid).
 */
export async function POST(req: NextRequest) {
  try {
    const sb = getSbAdmin();
    const body = await req.json().catch(() => { throw new Error("Invalid JSON body") });

    // --- Mode 1: Membuat Signature untuk Free Mint ---
    if (body?.mode === "free-sign") {
      const pk = process.env.FID_SIGNER_PK as `0x${string}` | undefined;
      if (!pk) throw new Error("FID_SIGNER_PK is not configured on the server.");

      const { fid, to, inviter } = body;
      if (!fid || !to || !inviter || !isAddress(to) || !isAddress(inviter)) {
        return NextResponse.json({ error: "fid, to (address), and inviter (address) are required." }, { status: 400 });
      }

      // Deadline 15 menit dari sekarang. Dinyatakan dalam UNIX timestamp (detik).
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 15 * 60);
      const message = { fid: BigInt(fid), to, inviter, deadline };

      const account = privateKeyToAccount(pk);
      const signature = await account.signTypedData({
        domain: EIP712_DOMAIN,
        types: EIP712_TYPES,
        primaryType: "ClaimRequest",
        message,
      });
      
      const { v, r, s } = splitSignature(signature);
      
      return NextResponse.json({ ...message, v: Number(v), r, s, deadline: deadline.toString() });
    }

    // --- Mode 2: "Touching" a new referral (status: pending) ---
    if (body?.action === "touch") {
      const { inviter, invitee_fid, invitee_wallet } = body;
      if (!inviter || !invitee_fid || !isAddress(inviter)) {
        return NextResponse.json({ error: "inviter (address) and invitee_fid are required." }, { status: 400 });
      }
      
      const { error } = await sb.from("referrals").upsert({
        invitee_fid: Number(invitee_fid),
        inviter: String(inviter).toLowerCase(),
        invitee_wallet: invitee_wallet ? String(invitee_wallet).toLowerCase() : null,
        status: 'pending', // Status awal selalu 'pending'
      }, { onConflict: 'invitee_fid' }); // Jika invitee sudah ada, jangan buat duplikat

      if (error) throw error;
      return NextResponse.json({ success: true, message: "Referral touched." });
    }

    // --- Mode 3: Marking a referral as valid (after successful tx) ---
    if (body?.action === "mark-valid") {
        const { invitee_fid, invitee_wallet } = body;
        if (!invitee_fid) {
            return NextResponse.json({ error: "invitee_fid is required." }, { status: 400 });
        }

        const updatePayload: { status: string, invitee_wallet?: string } = { status: 'valid' };
        if (invitee_wallet && isAddress(invitee_wallet)) {
            updatePayload.invitee_wallet = String(invitee_wallet).toLowerCase();
        }

        const { error } = await sb
            .from('referrals')
            .update(updatePayload)
            .eq('invitee_fid', Number(invitee_fid))
            .eq('status', 'pending'); // Hanya update yang masih pending

        if (error) throw error;
        return NextResponse.json({ success: true, message: "Referral marked as valid." });
    }

    return NextResponse.json({ error: "Invalid mode or action provided" }, { status: 400 });

  } catch (e: any) {
    console.error("POST /api/referral Error:", e);
    return NextResponse.json({ success: false, error: e.message || "An unexpected server error occurred" }, { status: 500 });
  }
}

