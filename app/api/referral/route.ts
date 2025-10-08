// app/api/referral/route.ts (MAINNET READY, all functions preserved)

import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { getSupabaseAdmin } from "../../lib/supabase/server";
import { privateKeyToAccount } from "viem/accounts";
import { rigSaleAddress } from "../../lib/web3Config"; // fallback jika env kosong
import { base } from "viem/chains";

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
   ENV & Const
   ========================= */
const MINT_MODE = (process.env.REFERRAL_MINT_MODE || "none").toLowerCase();
const BACKEND_SIGNER_PK =
  process.env.BACKEND_SIGNER_PK || process.env.RELAYER_PRIVATE_KEY || "";
const RIGSALE_ADDRESS = process.env.CONTRACT_RIGSALE || ""; // ← set alamat MAINNET di env
const RIGNFT_ADDRESS = process.env.CONTRACT_RIGNFT || "";
const RPC_URL = process.env.RPC_URL || "https://mainnet.base.org"; // ← mainnet
const BASIC_ID = 1;

const TABLE_REFERRALS = "referrals";
const TABLE_CLAIMS = "claims";

const ABI_RIGSALE = [
  "function mintRewardRig(address to, uint256 id, uint256 amount) external",
];
const ABI_RIGNFT = [
  "function mintByGame(address to, uint256 id, uint256 amount) external",
];

/* =========================
   Utils
   ========================= */
function normalizeAddr(value: string | undefined | null): string {
  return (value || "").toLowerCase().trim();
}
function assertAddress(value: string, name: string) {
  if (!ethers.isAddress(value)) {
    throw new Error(`Field "${name}" harus berupa address EVM yang valid.`);
  }
}
function requireFidText(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Field "${name}" wajib diisi (string).`);
  }
  const v = value.trim();
  if (!/^\d+$/.test(v)) {
    throw new Error(`Field "${name}" harus berupa angka Farcaster ID yang valid.`);
  }
  return v; // TEXT di DB
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

/**
 * Upsert referral (pending/valid). HANYA dipakai saat inviter address sudah diketahui.
 * Kolom: inviter (TEXT, PK#1), invitee_fid (TEXT, PK#2), status, invitee_wallet?
 */
async function upsertReferralRow(
  inviterWallet: string,
  inviteeFidText: string,
  status: "pending" | "valid",
  inviteeWallet?: string | null,
  inviterId?: string | null,
  inviteeId?: string | null
) {
  const payload: Record<string, any> = {
    inviter: inviterWallet,
    invitee_fid: inviteeFidText,
    status,
  };
  if (inviteeWallet) payload.invitee_wallet = normalizeAddr(inviteeWallet);
  if (inviterId) payload.inviter_id = inviterId;
  if (inviteeId) payload.invitee_id = inviteeId;

  const { error } = await getSupabaseAdmin()
    .from(TABLE_REFERRALS)
    .upsert(payload, { onConflict: "inviter,invitee_fid" });
  if (error) throw new Error(`Gagal menyimpan referral: ${error.message}`);
}

function getProviderAndSigner() {
  if (!BACKEND_SIGNER_PK) return { provider: null, signer: null };
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signer = new ethers.Wallet(BACKEND_SIGNER_PK, provider);
  return { provider, signer };
}

async function mintRewardViaRigSale(to: string) {
  const { signer } = getProviderAndSigner();
  if (!signer) throw new Error("Signer backend tidak dikonfigurasi.");
  if (!RIGSALE_ADDRESS) throw new Error("CONTRACT_RIGSALE belum diset.");
  const contract = new ethers.Contract(RIGSALE_ADDRESS, ABI_RIGSALE, signer);
  const tx = await contract.mintRewardRig(to, BASIC_ID, 1);
  const receipt = await tx.wait();
  return receipt?.hash ?? tx.hash;
}

async function mintRewardViaRigNFT(to: string) {
  const { signer } = getProviderAndSigner();
  if (!signer) throw new Error("Signer backend tidak dikonfigurasi.");
  if (!RIGNFT_ADDRESS) throw new Error("CONTRACT_RIGNFT belum diset.");
  const contract = new ethers.Contract(RIGNFT_ADDRESS, ABI_RIGNFT, signer);
  const tx = await contract.mintByGame(to, BASIC_ID, 1);
  const receipt = await tx.wait();
  return receipt?.hash ?? tx.hash;
}

/* =========================
   POST
   ========================= */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const mode = String(body?.mode || "");

    switch (mode) {
      case "touch": {
        // catat referral pending — BUTUH inviter wallet
        const inviter = normalizeAddr(body.inviter);
        const invitee_fid = requireFidText(body.invitee_fid, "invitee_fid");
        assertAddress(inviter, "inviter");
        await upsertReferralRow(inviter, invitee_fid, "pending", body.invitee_wallet ?? null);
        return NextResponse.json({ ok: true });
      }

      case "mark-valid": {
        // tandai referral valid
        const invitee_fid = requireFidText(body.invitee_fid, "invitee_fid");
        const inviterRaw = normalizeAddr(body.inviter);
        const invitee_wallet = body.invitee_wallet ? normalizeAddr(body.invitee_wallet) : null;

        if (inviterRaw) {
          // jika inviter dikirim → update/upsert baris (inviter, invitee_fid)
          assertAddress(inviterRaw, "inviter");
          await upsertReferralRow(inviterRaw, invitee_fid, "valid", invitee_wallet);
          return NextResponse.json({ ok: true, message: "Referral marked valid (by inviter)." });
        }

        // jika inviter TIDAK dikirim → JANGAN bikin baris baru dengan inviter kosong.
        // Update semua baris yang existing utk invitee_fid tsb.
        const sb = getSupabaseAdmin();
        const q = sb
          .from(TABLE_REFERRALS)
          .update({ status: "valid", ...(invitee_wallet ? { invitee_wallet } : {}) })
          .eq("invitee_fid", invitee_fid);
        const { error } = await q;
        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
        return NextResponse.json({ ok: true, message: "Referral marked valid (by invitee_fid)." });
      }

      case "claim": {
        // mint reward untuk inviter jika quota cukup
        const inviter = normalizeAddr(body.inviter);
        const receiver = normalizeAddr(body.receiver);
        const invitee_fid = requireFidText(body.invitee_fid, "invitee_fid");
        assertAddress(inviter, "inviter");
        assertAddress(receiver, "receiver");

        if (!MINT_MODE || MINT_MODE === "none") {
          return NextResponse.json({ ok: false, error: "Minting not configured." }, { status: 400 });
        }

        const [validInvites, usedClaims] = await Promise.all([
          countValidInvites(inviter),
          sumUsedClaims(inviter),
        ]);
        const remaining = remainingClaims(validInvites, usedClaims);
        if (remaining <= 0) {
          return NextResponse.json({ ok: false, error: "No remaining claims." }, { status: 400 });
        }

        let txHash: string;
        if (MINT_MODE === "rigsale") {
          txHash = await mintRewardViaRigSale(receiver);
        } else if (MINT_MODE === "rignft") {
          txHash = await mintRewardViaRigNFT(receiver);
        } else {
          return NextResponse.json({ ok: false, error: "Invalid mint mode." }, { status: 500 });
        }

        await recordClaim(inviter, 1, txHash);
        // (opsional) kamu bisa sekaligus menandai referral tertentu jadi valid di sini bila mau.
        return NextResponse.json({ ok: true, txHash, invitee_fid });
      }

      case "free-sign": {
        // generate EIP-712 signature untuk free claim (30 menit)
        const pk = process.env.BACKEND_SIGNER_PK || process.env.RELAYER_PRIVATE_KEY;
        if (!pk) return NextResponse.json({ error: "Backend signer PK missing." }, { status: 500 });

        const fidStr = requireFidText(body.fid, "fid");
        const to = normalizeAddr(body.to);
        const inviterAddr = normalizeAddr(body.inviter);
        if (!ethers.isAddress(to) || !ethers.isAddress(inviterAddr)) {
          return NextResponse.json({ error: "Missing/invalid 'to' or 'inviter' address." }, { status: 400 });
        }

        const fid = BigInt(fidStr);
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 30 * 60);
        const account = privateKeyToAccount(pk as `0x${string}`);

        // ==== EIP-712 DOMAIN (MAINNET) ====
        const domain = {
          name: "RigSaleFlexible",
          version: "1",
          chainId: base.id, // 8453
          // Prefer env (CONTRACT_RIGSALE) untuk alamat MAINNET; fallback ke konstanta.
          verifyingContract: (RIGSALE_ADDRESS || rigSaleAddress) as `0x${string}`,
        };

        const types = {
          FreeClaim: [
            { name: "fid", type: "uint256" },
            { name: "to", type: "address" },
            { name: "inviter", type: "address" },
            { name: "deadline", type: "uint256" },
          ],
        } as const;

        const message = {
          fid,
          to: to as `0x${string}`,
          inviter: inviterAddr as `0x${string}`,
          deadline,
        };

        const signature = await account.signTypedData({
          domain,
          types,
          primaryType: "FreeClaim",
          message,
        });

        const v = parseInt(signature.slice(130, 132), 16);
        const r = signature.slice(0, 66) as `0x${string}`;
        const s = ("0x" + signature.slice(66, 130)) as `0x${string}`;

        return NextResponse.json({
          ok: true,
          v,
          r,
          s,
          inviter: inviterAddr,
          deadline: deadline.toString(),
        });
      }

      default:
        return NextResponse.json({ error: "Unknown mode" }, { status: 400 });
    }
  } catch (e: any) {
    console.error("API referral error:", e);
    const msg = String(e?.message || "Server error");
    if (msg.includes("TRANSACTION REVERTED")) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/* =========================
   GET: statistik inviter
   ========================= */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const inviter = normalizeAddr(searchParams.get("inviter"));
  const detail = searchParams.get("detail") === "1";

  if (!ethers.isAddress(inviter)) {
    return NextResponse.json({ ok: false, error: "Invalid inviter address." }, { status: 400 });
  }

  const [validInvites, usedClaims] = await Promise.all([
    countValidInvites(inviter),
    sumUsedClaims(inviter),
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
      .eq("inviter", inviter);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    response.list = data;
  }

  return NextResponse.json(response);
}