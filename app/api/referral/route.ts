// app/api/referral/route.ts
//
// This module defines a Next.js API route for managing referral logic.
// It includes operations for tracking referrals (`touch`), marking a
// referral as valid (`mark-valid`), minting rewards (`claim`), and
// generating signatures for free claims (`free-sign`).  This updated
// version adjusts the expiry window for free claim signatures: the
// `deadline` used in the EIP-712 message is extended from 15 minutes
// to 30 minutes to reduce the likelihood of expired transactions on
// the bundler/relayer.  No other functional changes are introduced.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ethers } from "ethers";
import { getSupabaseAdmin } from "../../lib/supabase/server";
import { privateKeyToAccount } from "viem/accounts";
import { rigSaleAddress } from "../../lib/web3Config";
import { baseSepolia } from "viem/chains";

// Ensures the route is always dynamically rendered, reading the latest
// environment variables on Vercel.
export const dynamic = "force-dynamic";

/* =========================
   Invite Tiering
   ========================= */
function calculateMaxClaims(validInvites: number): number {
  if (!Number.isFinite(validInvites) || validInvites <= 0) return 0;
  const first = validInvites >= 1 ? 1 : 0;
  const midInvites = Math.max(Math.min(validInvites, 11) - 1, 0);
  const mid = Math.floor(midInvites / 2);
  const tailInvites = Math.max(validInvites - 11, 0);
  const tail = Math.floor(tailInvites / 3);
  return first + mid + tail;
}

function remainingClaims(validInvites: number, usedClaims: number): number {
  const maxClaims = calculateMaxClaims(validInvites);
  const used = Number.isFinite(usedClaims) ? Math.max(0, usedClaims) : 0;
  return Math.max(0, maxClaims - used);
}

/* =========================
   ENV VARS & Constants
   ========================= */
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const MINT_MODE = (process.env.REFERRAL_MINT_MODE || "none").toLowerCase();
const BACKEND_SIGNER_PK = process.env.BACKEND_SIGNER_PK || process.env.RELAYER_PRIVATE_KEY || "";
const RIGSALE_ADDRESS = process.env.CONTRACT_RIGSALE || "";
const RIGNFT_ADDRESS  = process.env.CONTRACT_RIGNFT  || "";
const RPC_URL = process.env.RPC_URL || "https://sepolia.base.org";
const BASIC_ID = 1;

const TABLE_REFERRALS = "referrals";
const TABLE_CLAIMS    = "claims";

// FIX: Kembali menggunakan ABI string sederhana untuk menghindari Build Error.
const ABI_RIGSALE = ["function mintBySale(address to, uint256 id, uint256 amount) external"];
const ABI_RIGNFT = ["function mintByGame(address to, uint256 id, uint256 amount) external"];

/* =========================
   Utility Functions
   ========================= */
function getProviderAndSigner() {
  if (!BACKEND_SIGNER_PK) return { provider: null, signer: null };
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signer = new ethers.Wallet(BACKEND_SIGNER_PK, provider);
  return { provider, signer };
}

function requireString(value: unknown, name: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Field "${name}" wajib diisi (string).`);
  }
}

function requireAddress(value: string, name: string) {
  if (!ethers.isAddress(value)) {
    throw new Error(`Field "${name}" harus berupa address EVM yang valid.`);
  }
}

function requireFidString(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Field "${name}" wajib diisi (string).`);
  }
  if (!/^\d+$/.test(value.trim())) {
    throw new Error(`Field "${name}" harus berupa angka Farcaster ID yang valid.`);
  }
  return value.trim();
}

async function countValidInvites(inviter: string) {
  const { count, error } = await getSupabaseAdmin()
    .from(TABLE_REFERRALS)
    .select("*", { count: "exact", head: true })
    .eq("inviter", inviter)
    .eq("status", "valid");
  if (error) throw new Error(`Gagal hitung valid invites: ${error.message}`);
  return count ?? 0;
}

async function sumUsedClaims(inviter: string) {
  const { data, error } = await getSupabaseAdmin()
    .from(TABLE_CLAIMS)
    .select("amount")
    .eq("inviter", inviter)
    .eq("type", "basic_free");
  if (error) throw new Error(`Gagal ambil used claims: ${error.message}`);
  return (data || []).reduce((acc: number, r: any) => acc + (Number(r.amount) || 0), 0);
}

async function recordClaim(inviter: string, amount: number, txHash: string) {
  const { error } = await getSupabaseAdmin().from(TABLE_CLAIMS).insert({
    inviter,
    type: "basic_free",
    amount,
    tx_hash: txHash,
  });
  if (error) throw new Error(`Gagal mencatat klaim: ${error.message}`);
}

async function trackReferral(
  inviter: string,
  invitee_fid: string,
  status: "pending" | "valid" = "pending",
  invitee_wallet: string | null = null,
) {
  const data: { inviter: string; invitee_fid: string; status: "pending" | "valid"; invitee_wallet?: string } = { inviter, invitee_fid, status };
  if (invitee_wallet) {
    data.invitee_wallet = invitee_wallet;
  }
  const { error } = await getSupabaseAdmin()
    .from(TABLE_REFERRALS)
    .upsert(data, { onConflict: "inviter,invitee_fid" });
  if (error) throw new Error(`Gagal menyimpan referral: ${error.message}`);
}

// Fungsi Minting Reward NFT via RigSale
async function mintBasicViaRigSale(to: string) {
  const { signer } = getProviderAndSigner();
  if (!signer) throw new Error("Signer backend tidak dikonfigurasi.");
  if (!RIGSALE_ADDRESS) throw new Error("CONTRACT_RIGSALE belum diset.");

  // ABI digunakan untuk memanggil fungsi minting di kontrak RigSale
  const contract = new ethers.Contract(RIGSALE_ADDRESS, ABI_RIGSALE, signer);

  try {
    // FIX: Minting Reward menggunakan fungsi yang sama dengan klaim user.
    // Jika Reward NFT harusnya Basic Rig ID 1, panggil mintBySale.
    const tx = await contract.mintBySale(to, BASIC_ID, 1);

    // Tunggu konfirmasi, jika gagal, akan ditangkap di catch block
    const receipt = await tx.wait();
    return receipt?.hash ?? tx.hash;
  } catch (e: any) {
    console.error("Relayer Transaction failed with error:", e.message);
    throw e;
  }
}

// Fungsi Minting Reward NFT via RigNFT (jika MINT_MODE = "rignft")
async function mintBasicViaRigNFT(to: string) {
  const { signer } = getProviderAndSigner();
  if (!signer) throw new Error("Signer backend tidak dikonfigurasi.");
  if (!RIGNFT_ADDRESS) throw new Error("CONTRACT_RIGNFT belum diset.");

  const contract = new ethers.Contract(RIGNFT_ADDRESS, ABI_RIGNFT, signer);
  try {
    const tx = await contract.mintByGame(to, BASIC_ID, 1);
    const receipt = await tx.wait();
    return receipt?.hash ?? tx.hash;
  } catch (e: any) {
    console.error("Relayer Transaction failed with error:", e.message);
    throw e;
  }
}

/**
 * Main entry for POST requests. Depending on `mode` in the body,
 * performs referral tracking, marking, claim reward, or generating a
 * signature for free claim. See the `case` statements for
 * individual logic.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const mode = body?.mode;
    switch (mode) {
      case "touch": {
        const inviter = String(body.inviter || "").toLowerCase();
        const invitee_fid = requireFidString(body.invitee_fid, "invitee_fid");
        requireAddress(inviter, "inviter");
        await trackReferral(inviter, invitee_fid, "pending");
        return NextResponse.json({ ok: true });
      }
      case "mark-valid": {
        const invitee_fid = requireFidString(body.invitee_fid, "invitee_fid");
        const invitee_wallet = body.invitee_wallet as string | undefined;
        const inviter = String(body.inviter || "").toLowerCase();
        if (!inviter) {
          // inviter optional: Upsert only by invitee_fid
          await trackReferral("", invitee_fid, "valid", invitee_wallet ?? null);
        } else {
          requireAddress(inviter, "inviter");
          await trackReferral(inviter, invitee_fid, "valid", invitee_wallet ?? null);
        }
        return NextResponse.json({ ok: true, message: "Referral marked valid." });
      }
      case "claim": {
        const inviter = String(body.inviter || "").toLowerCase();
        const receiver = String(body.receiver || "").toLowerCase();
        const invitee_fid = requireFidString(body.invitee_fid, "invitee_fid");
        requireAddress(inviter, "inviter");
        requireAddress(receiver, "receiver");
        if (!MINT_MODE || MINT_MODE === "none") {
          return NextResponse.json({ ok: false, error: "Minting not configured." }, { status: 400 });
        }
        // Check remaining quota
        const [validInvites, usedClaims] = await Promise.all([
          countValidInvites(inviter),
          sumUsedClaims(inviter),
        ]);
        const remaining = remainingClaims(validInvites, usedClaims);
        if (remaining <= 0) {
          return NextResponse.json({ ok: false, error: "No remaining claims." }, { status: 400 });
        }
        // Mint reward based on mint mode
        let txHash: string;
        if (MINT_MODE === "rigsale") {
          txHash = await mintBasicViaRigSale(receiver);
        } else if (MINT_MODE === "rignft") {
          txHash = await mintBasicViaRigNFT(receiver);
        } else {
          return NextResponse.json({ ok: false, error: "Invalid mint mode." }, { status: 500 });
        }
        // Record claim in database
        await recordClaim(inviter, 1, txHash);
        return NextResponse.json({ ok: true, txHash });
      }
      case "free-sign": {
        const pk = process.env.BACKEND_SIGNER_PK || process.env.RELAYER_PRIVATE_KEY;
        if (!pk) {
          return NextResponse.json({ error: "Backend signer PK missing." }, { status: 500 });
        }
        const fidStr = requireFidString(body.fid, "fid");
        if (!body.to || !body.inviter || !ethers.isAddress(body.to)) {
          return NextResponse.json({ error: "Missing 'to' or 'inviter' address, or invalid 'to'." }, { status: 400 });
        }
        const fid = BigInt(fidStr);
        const to = body.to as `0x${string}`;
        const inviter = (body.inviter as string).toLowerCase() as `0x${string}`;

        // Extend deadline from 15 minutes to 30 minutes to avoid expired signatures.
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 30 * 60);

        const account = privateKeyToAccount(pk as `0x${string}`);
        const domain = {
          name: "RigSaleFlexible",
          version: "1",
          chainId: baseSepolia.id,
          verifyingContract: rigSaleAddress as `0x${string}`,
        };
        const types = {
          FreeClaim: [
            { name: "fid", type: "uint256" },
            { name: "to", type: "address" },
            { name: "inviter", type: "address" },
            { name: "deadline", type: "uint256" },
          ],
        } as const;
        const message = { fid, to, inviter, deadline };
        const signature = await account.signTypedData({ domain, types, primaryType: "FreeClaim", message });
        const v = parseInt(signature.slice(130, 132), 16);
        const r = signature.slice(0, 66) as `0x${string}`;
        const s = ("0x" + signature.slice(66, 130)) as `0x${string}`;
        return NextResponse.json({ ok: true, v, r, s, inviter, deadline: deadline.toString() });
      }
      default:
        return NextResponse.json({ error: "Unknown mode" }, { status: 400 });
    }
  } catch (e: any) {
    console.error("API referral error:", e);
    // Map specific errors to user-friendly responses
    let errorMessage = String(e?.message || "Server error");
    if (errorMessage.includes("TRANSACTION REVERTED")) {
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    if (errorMessage.includes("fid is required and must be a number")) {
      return NextResponse.json({ error: "Validasi data umum gagal: FID Pengundang diperlukan." }, { status: 400 });
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * GET handler returns referral statistics for an inviter. Include
 * `detail=1` to also return the list of invitees and their status.  The
 * response includes the current mint mode, number of valid invites,
 * number of claimed rewards, and remaining quota.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const inviter = searchParams.get("inviter") ?? "";
  const detail = searchParams.get("detail") === "1";
  if (!ethers.isAddress(inviter)) {
    return NextResponse.json({ ok: false, error: "Invalid inviter address." }, { status: 400 });
  }
  const lowerCaseInviter = inviter.toLowerCase();
  const [validInvites, usedClaims] = await Promise.all([
    countValidInvites(lowerCaseInviter),
    sumUsedClaims(lowerCaseInviter),
  ]);
  const remainingQuota = remainingClaims(validInvites, usedClaims);
  const response: any = {
    ok: true,
    mintMode: MINT_MODE,
    validInvites,
    claimedRewards: usedClaims,
    remainingQuota,
  };
  if (detail) {
    const { data, error } = await getSupabaseAdmin()
      .from(TABLE_REFERRALS)
      .select("invitee_fid, invitee_wallet, status")
      .eq("inviter", lowerCaseInviter);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    response.list = data;
  }
  return NextResponse.json(response);
}
