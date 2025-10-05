import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ethers } from "ethers";
import { getSupabaseAdmin } from "../../lib/supabase/server";
import { privateKeyToAccount } from "viem/accounts";
import { rigSaleAddress } from "../../lib/web3Config"; 
import { baseSepolia } from "viem/chains"; 
import { ABI as RIGSALE_ABI } from "../lib/abi/rigSale.json"; // Ambil ABI yang lengkap

// Ensures the route is always dynamically rendered, reading the latest environment variables on Vercel.
export const dynamic = "force-dynamic";

/* =========================
   Invite Tiering
   ========================= */
// ... (calculateMaxClaims dan remainingClaims tetap sama)

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
// Gunakan BACKEND_SIGNER_PK untuk konsistensi
const BACKEND_SIGNER_PK = process.env.BACKEND_SIGNER_PK || process.env.RELAYER_PRIVATE_KEY || ""; 
const RIGSALE_ADDRESS = process.env.CONTRACT_RIGSALE || "";
const RIGNFT_ADDRESS  = process.env.CONTRACT_RIGNFT  || "";
const RPC_URL = process.env.RPC_URL || "https://sepolia.base.org";
const BASIC_ID = 1;

const TABLE_REFERRALS = "referrals";
const TABLE_CLAIMS    = "claims";

// FIX: Gunakan ABI yang lebih lengkap dari file JSON
// const ABI_RIGSALE = ["function mintBySale(address to, uint256 id, uint256 amount) external"]; 
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
// ... (requireString, requireAddress, requireFidString, countValidInvites, sumUsedClaims, recordClaim, trackReferral tetap sama)

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

async function trackReferral(inviter: string, invitee_fid: string, status: "pending" | "valid" = "pending", invitee_wallet: string | null = null) {
  const data: { inviter: string; invitee_fid: string; status: "pending" | "valid"; invitee_wallet?: string } = { inviter, invitee_fid, status };
  if (invitee_wallet) {
    data.invitee_wallet = invitee_wallet;
  }
  const { error } = await getSupabaseAdmin()
    .from(TABLE_REFERRALS)
    .upsert(data, { onConflict: "inviter,invitee_fid" });
  if (error) throw new Error(`Gagal menyimpan referral: ${error.message}`);
}


// FIX: Fungsi Minting Reward NFT via RigSale
async function mintBasicViaRigSale(to: string) {
  const { signer } = getProviderAndSigner();
  if (!signer) throw new Error("Signer backend tidak dikonfigurasi.");
  if (!RIGSALE_ADDRESS) throw new Error("CONTRACT_RIGSALE belum diset.");
  
  // FIX: Kita asumsikan fungsi yang benar untuk Mint Reward via relayer adalah mintRewards
  // atau fungsi internal yang dapat diakses oleh relayer.
  // Jika RigSale adalah kontrak yang memiliki fungsi Minting Reward, 
  // kita harus memanggil fungsi yang sesuai dengan ID NFT Rig Basic (ID 1).
  
  // Kita asumsikan fungsi Mint Reward adalah 'mintRewards' atau 'mintByRelayer'
  // Karena Anda menggunakan RigSale, kita asumsikan fungsinya adalah yang mengelola rewards:
  const RELAYER_ABI = [
      "function mintRewards(address _to, uint256 _id, uint256 _amount) external",
      "function mintBySale(address to, uint256 id, uint256 amount) external", // Fallback
      // Tambahkan ABI spesifik RewardsVault atau fungsi Mint Rewards jika ada.
  ];

  try {
    const contract = new ethers.Contract(RIGSALE_ADDRESS, RELAYER_ABI, signer);
    
    // Minta kontrak untuk mengirim transaksi mint NFT ke alamat pengguna.
    // Kita panggil mintBySale dengan ID NFT Rig Basic (ID 1)
    const tx = await contract.mintBySale(to, BASIC_ID, 1);
    
    const receipt = await tx.wait();
    return receipt?.hash ?? tx.hash;

  } catch(e: any) {
      console.error("Relayer Transaction failed with error:", e.message);
      // Jika RPC gagal dengan error revert, kontrak mungkin tidak memberikan izin (revert).
      throw new Error(`Transaction Reverted (Kontrak menolak minting). Error: ${e.reason || e.code}`);
  }
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
   MAIN POST HANDLER (Writes data)
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
        const invitee_fid_str = requireFidString(body.invitee_fid, "invitee_fid");
        
        const inviter = body.inviter.trim().toLowerCase(); 
        const invitee_fid = invitee_fid_str;
        const invitee_wallet = body.invitee_wallet ? body.invitee_wallet.toLowerCase() : null;
        const status = (body.status === "valid" ? "valid" : "pending") as "pending" | "valid";
        
        await trackReferral(inviter, invitee_fid, status, invitee_wallet);
        return NextResponse.json({ ok: true });
      }

      case "stats": {
        requireString(body.inviter, "inviter");
        const inviter = body.inviter.trim().toLowerCase(); 
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
        requireFidString(body.invitee_fid, "invitee_fid");

        const inviterAddress = body.inviter.trim().toLowerCase(); 
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
          // FIX: Pastikan CONTRACT_RIGSALE, BACKEND_SIGNER_PK diisi & signer punya ETH
          txHash = await mintBasicViaRigSale(receiverAddress); 
        } else if (MINT_MODE === "rignft") {
          txHash = await mintBasicViaRigNFT(receiverAddress);
        } else {
          txHash = "0x" + "0".repeat(63) + "beef"; // Mock tx for "none" mode
        }

        // FIX: Mencatat klaim HANYA setelah transaksi berhasil dikirim/diproses oleh relayer
        await recordClaim(inviterAddress, 1, txHash);
        
        return NextResponse.json({ ok: true, txHash });
      }
      
      // ... (mark-valid, free-sign, dan GET handler tetap sama) ...
      case "mark-valid": {
          const invitee_fid_str = requireFidString(body.invitee_fid, "invitee_fid");
          requireString(body.invitee_wallet, "invitee_wallet");
          
          const invitee_fid = invitee_fid_str;
          const invitee_wallet = String(body.invitee_wallet).trim().toLowerCase();

          // Cari dan update status di Supabase berdasarkan invitee_fid
          const { data: updateData, error: updateError } = await getSupabaseAdmin()
              .from(TABLE_REFERRALS)
              .update({ status: "valid", invitee_wallet: invitee_wallet })
              .eq("invitee_fid", invitee_fid)
              .eq("status", "pending")
              .select("inviter") 
              .maybeSingle();

          if (updateError) {
              throw new Error(`Gagal update referral status: ${updateError.message}`);
          }
          
          if (!updateData) {
              return NextResponse.json({ ok: true, message: "Referral already marked valid or not found." });
          }

          if (SUPABASE_URL && SUPABASE_ANON_KEY) {
              const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
              const inviterAddress = updateData.inviter;

              const { data: inviterData } = await getSupabaseAdmin()
                  .from('users')
                  .select('fid')
                  .eq('wallet', inviterAddress.toLowerCase())
                  .maybeSingle();

              if (inviterData?.fid) {
                  supabaseAnon.functions.invoke('add-referral-points', {
                      body: { 
                          referrer_fid: inviterData.fid,
                          referred_fid: invitee_fid 
                      }
                  }).catch(console.error);
              }
          }

          return NextResponse.json({ ok: true, message: "Referral marked valid." });
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
        const inviter = body.inviter.toLowerCase() as `0x${string}`;

        const deadline = BigInt(Math.floor(Date.now() / 1000) + 15 * 60);
        
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

        const message = {
            fid: fid,
            to: to,
            inviter: inviter,
            deadline,
        };

        const signature = await account.signTypedData({
            domain, types, primaryType: "FreeClaim", message,
        });
        
        const v = parseInt(signature.slice(130, 132), 16); 
        const r = signature.slice(0, 66) as `0x${string}`;
        const s = ('0x' + signature.slice(66, 130)) as `0x${string}`;

        return NextResponse.json({
            ok: true,
            v, r, s,
            inviter: inviter,
            deadline: deadline.toString(),
        });
    }

      default:
        return NextResponse.json({ error: "Unknown mode" }, { status: 400 });
    }
  } catch (e: any) {
    console.error("API referral error:", e);
    if (e.message.includes("fid is required and must be a number")) {
        return NextResponse.json({ error: "Validasi data umum gagal: FID Pengundang diperlukan. Pastikan Anda memiliki FID yang sah." }, { status: 400 });
    }
    // Tangani error revert dengan menampilkan pesan yang lebih jelas
    if (e.message.includes("Transaction Reverted")) {
         return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: String(e?.message || "Server error") }, { status: 500 });
  }
}

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
          .select('invitee_fid, invitee_wallet, status')
          .eq('inviter', lowerCaseInviter);

      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      response.list = data;
  }

  return NextResponse.json(response);
}

