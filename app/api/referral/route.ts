// app/api/referral/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ethers } from "ethers";
import { getSupabaseAdmin } from "../../lib/supabase/server";

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

async function trackReferral(inviter: string, invitee_fid: string, status: "pending" | "valid" = "pending") {
  const { error } = await getSupabaseAdmin()
    .from(TABLE_REFERRALS)
    .upsert({ inviter, invitee_fid, status }, { onConflict: "inviter,invitee_fid" });
  if (error) throw new Error(`Gagal menyimpan referral: ${error.message}`);
}

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
   MAIN POST HANDLER
   ========================= */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const mode = String(body?.mode || "").toLowerCase();
    if (!mode) {
      return NextResponse.json({ error: "Mode wajib diisi." }, { status: 400 });
    }

    switch (mode) {
      case "touch":
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
        return NextResponse.json({ ok: true, data: { validInvites, usedClaims, remainingQuota: quota } });
      }

      case "claim": {
        requireString(body.inviter, "inviter");
        requireString(body.receiver, "receiver");
        requireString(body.invitee_fid, "invitee_fid"); // Diperlukan untuk memberi poin

        const inviterAddress = body.inviter.trim();
        const receiverAddress = body.receiver.trim();
        const inviteeFid = body.invitee_fid;
        requireAddress(receiverAddress, "receiver");

        const [validInvites, usedClaims] = await Promise.all([
            countValidInvites(inviterAddress),
            sumUsedClaims(inviterAddress),
        ]);
        const quota = remainingClaims(validInvites, usedClaims);
        if (quota <= 0) {
            return NextResponse.json({ error: "No free-claim quota" }, { status: 400 });
        }

        let txHash: string;
        if (MINT_MODE === "rigsale") {
          txHash = await mintBasicViaRigSale(receiverAddress);
        } else if (MINT_MODE === "rignft") {
          txHash = await mintBasicViaRigNFT(receiverAddress);
        } else {
          txHash = "0x" + "0".repeat(63) + "beef"; // Mock tx for "none" mode
        }

        await recordClaim(inviterAddress, 1, txHash);
        
        // --- Integrasi Leaderboard ---
        // Panggil Edge Function untuk menambahkan poin setelah klaim berhasil.
        // Dijalankan secara "fire-and-forget" agar tidak memblokir respons.
        if (SUPABASE_URL && SUPABASE_ANON_KEY) {
          const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
          const { data: inviterData } = await getSupabaseAdmin()
            .from('users')
            .select('fid')
            .eq('wallet', inviterAddress.toLowerCase())
            .single();

          if (inviterData?.fid) {
            supabase.functions.invoke('add-referral-points', {
                body: { 
                    referrer_fid: inviterData.fid,
                    referred_fid: inviteeFid 
                }
            }).catch(console.error); // Log error di server jika gagal, tapi jangan crash
          }
        }
        // -----------------------------

        return NextResponse.json({ ok: true, txHash });
      }

      default:
        return NextResponse.json({ error: "Unknown mode" }, { status: 400 });
    }
  } catch (e: any) {
    console.error("API referral error:", e);
    return NextResponse.json({ error: String(e?.message || "Server error") }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  // ... (fungsi GET tetap sama, tidak perlu diubah)
  return NextResponse.json({
    ok: true,
    mintMode: MINT_MODE,
  });
}
