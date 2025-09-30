// app/api/referral/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ethers } from "ethers";

/* =========================
   ✅ INLINE: Invite Tiering (tanpa import)
   ========================= */
function calculateMaxClaims(validInvites: number): number {
  if (!Number.isFinite(validInvites) || validInvites <= 0) return 0;
  const first = validInvites >= 1 ? 1 : 0;
  const midInvites = Math.max(Math.min(validInvites, 11) - 1, 0); // #2..#11 → 0..10
  const mid = Math.floor(midInvites / 2);
  const tailInvites = Math.max(validInvites - 11, 0);             // #12+
  const tail = Math.floor(tailInvites / 3);
  return first + mid + tail;
}
function remainingClaims(validInvites: number, usedClaims: number): number {
  const maxClaims = calculateMaxClaims(validInvites);
  const used = Number.isFinite(usedClaims) ? Math.max(0, usedClaims) : 0;
  return Math.max(0, maxClaims - used);
}

/* =========================
   ENV VARS (dengan fallback nama yang kamu pakai)
   ========================= */
// URL Supabase: pakai SUPABASE_URL → fallback ke NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;

// Service Role Key: dukung banyak nama yang kamu sebutkan
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE;

if (!SUPABASE_URL) {
  console.error("Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL");
}
if (!SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_SERVICE_KEY / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SERVICE_ROLE");
}

const NEXT_PUBLIC_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || process.env.CHAIN_ID || "84532"); // Base Sepolia
const RPC_URL = process.env.RPC_URL || "https://sepolia.base.org";

const RIGSALE_ADDRESS = process.env.CONTRACT_RIGSALE || "";
const RIGNFT_ADDRESS  = process.env.CONTRACT_RIGNFT  || "";
const MINT_MODE = (process.env.REFERRAL_MINT_MODE || "none").toLowerCase(); // "none" | "rigsale" | "rignft"

const BACKEND_SIGNER_PK =
  process.env.BACKEND_SIGNER_PK ||
  process.env.RELAYER_PRIVATE_KEY || // dukung nama lain yg kamu pakai
  "";

const BASIC_ID = 1;

const TABLE_REFERRALS = "referrals";
const TABLE_CLAIMS    = "claims";

/* =========================
   Minimal ABI
   ========================= */
const ABI_RIGSALE = [
  "function mintBySale(address to, uint256 id, uint256 amount) external"
];
const ABI_RIGNFT = [
  "function mintByGame(address to, uint256 id, uint256 amount) external",
];

/* =========================
   Utility: Supabase & Ethers
   ========================= */
function supabaseAdmin() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error("Supabase env missing: SUPABASE_URL / SUPABASE_SERVICE_KEY (or ROLE_KEY/ROLE).");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
}

function getProviderAndSigner() {
  if (!BACKEND_SIGNER_PK) return { provider: null, signer: null };
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signer = new ethers.Wallet(BACKEND_SIGNER_PK, provider);
  return { provider, signer };
}

/* =========================
   Validasi input sederhana
   ========================= */
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

/* =========================
   Query Helper (Supabase)
   ========================= */
async function countValidInvites(inviter: string) {
  const sb = supabaseAdmin();
  const { count, error } = await sb
    .from(TABLE_REFERRALS)
    .select("*", { count: "exact", head: true })
    .eq("inviter", inviter)
    .eq("status", "valid");

  if (error) throw new Error(`Gagal hitung valid invites: ${error.message}`);
  return count ?? 0;
}

async function sumUsedClaims(inviter: string) {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from(TABLE_CLAIMS)
    .select("amount")
    .eq("inviter", inviter)
    .eq("type", "basic_free");

  if (error) throw new Error(`Gagal ambil used claims: ${error.message}`);
  const used = (data || []).reduce((acc: number, r: any) => acc + (Number(r.amount) || 0), 0);
  return used;
}

async function recordClaim(inviter: string, amount: number, txHash: string) {
  const sb = supabaseAdmin();
  const { error } = await sb.from(TABLE_CLAIMS).insert({
    inviter,
    type: "basic_free",
    amount,
    tx_hash: txHash,
  });
  if (error) throw new Error(`Gagal mencatat klaim: ${error.message}`);
}

/* ✅ upsert idempotent (tanpa 'returning') */
async function trackReferral(
  inviter: string,
  invitee_fid: string,
  status: "pending" | "valid" = "pending"
) {
  const sb = supabaseAdmin();
  const { error } = await sb
    .from(TABLE_REFERRALS)
    .upsert(
      { inviter, invitee_fid, status },
      {
        onConflict: "inviter,invitee_fid",
        ignoreDuplicates: true,
      }
    );
  if (error) throw new Error(`Gagal menyimpan referral: ${error.message}`);
}

/* =========================
   Mint Helper
   ========================= */
async function mintBasicViaRigSale(to: string) {
  const { signer } = getProviderAndSigner();
  if (!signer) throw new Error("Signer backend tidak dikonfigurasi.");
  if (!RIGSALE_ADDRESS) throw new Error("CONTRACT_RIGSALE belum diset.");
  const contract = new ethers.Contract(RIGSALE_ADDRESS, ABI_RIGSALE, signer);
  const tx = await contract.mintBySale(to, BASIC_ID, 1);
  const receipt = await tx.wait();
  return receipt?.hash ?? tx.hash;
}
async function mintBasicViaRigNFT(to: string) {
  const { signer } = getProviderAndSigner();
  if (!signer) throw new Error("Signer backend tidak dikonfigurasi.");
  if (!RIGNFT_ADDRESS) throw new Error("CONTRACT_RIGNFT belum diset.");
  const contract = new ethers.Contract(RIGNFT_ADDRESS, ABI_RIGNFT, signer);
  const tx = await contract.mintByGame(to, BASIC_ID, 1);
  const receipt = await tx.wait();
  return receipt?.hash ?? tx.hash;
}

/* =========================
   Handler
   ========================= */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const mode = String(body?.mode || "").toLowerCase();
    if (!mode) {
      return NextResponse.json({ error: "Mode wajib diisi." }, { status: 400 });
    }

    switch (mode) {
      case "track": {
        requireString(body.inviter, "inviter");
        requireString(body.invitee_fid, "invitee_fid");
        const inviter = body.inviter.trim();
        const invitee_fid = String(body.invitee_fid).trim();
        const status = (body.status === "valid" ? "valid" : "pending") as "pending" | "valid";

        await trackReferral(inviter, invitee_fid, status);
        return NextResponse.json({ ok: true });
      }

      case "stats": {
        requireString(body.inviter, "inviter");
        const inviter = body.inviter.trim();

        const [validInvites, usedClaims] = await Promise.all([
          countValidInvites(inviter),
          sumUsedClaims(inviter),
        ]);
        const quota = remainingClaims(validInvites, usedClaims);

        return NextResponse.json({
          ok: true,
          data: { validInvites, usedClaims, remainingQuota: quota },
        });
      }

      case "claim": {
        requireString(body.inviter, "inviter");
        requireString(body.receiver, "receiver");

        const inviter = body.inviter.trim();
        const receiver = body.receiver.trim();
        requireAddress(receiver, "receiver");

        const [validInvites, usedClaims] = await Promise.all([
          countValidInvites(inviter),
          sumUsedClaims(inviter),
        ]);
        const quota = remainingClaims(validInvites, usedClaims);
        if (quota <= 0) {
          return NextResponse.json({ error: "No free-claim quota" }, { status: 400 });
        }

        let txHash = "0x";
        if (MINT_MODE === "rigsale") {
          txHash = await mintBasicViaRigSale(receiver);
        } else if (MINT_MODE === "rignft") {
          txHash = await mintBasicViaRigNFT(receiver);
        } else {
          txHash = "0x000000000000000000000000000000000000000000000000000000000000BEEF";
        }

        await recordClaim(inviter, 1, txHash);
        return NextResponse.json({ ok: true, txHash });
      }

      default:
        return NextResponse.json({ error: "Unknown mode" }, { status: 400 });
    }
  } catch (e: any) {
    console.error("API referral error:", e);
    const msg = String(e?.message || "Server error");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/* =========================
   GET: optional ping/status
   ========================= */
export async function GET() {
  return NextResponse.json({
    ok: true,
    chainId: NEXT_PUBLIC_CHAIN_ID,
    mintMode: MINT_MODE,
  });
}

