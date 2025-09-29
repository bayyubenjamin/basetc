// app/api/referral/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Wallet, TypedDataDomain, Signature } from "ethers";
import { rigSaleAddress } from "@/app/lib/web3Config"; // sesuaikan path!
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

function getWallet(): Wallet | null {
  const pk = process.env.FID_SIGNER_PK; // 0x...
  if (!pk) return null;
  return new Wallet(pk);
}

// --- GET ?inviter=0x... -> (kalau kamu pakai DB klaim, balikin claimedRewards). Di sini minimal placeholder:
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const inviter = (searchParams.get("inviter") || "").trim();
  // TODO: ambil dari DB kalau kamu pakai tracking klaim. Untuk sekarang nol saja supaya UI jalan.
  return NextResponse.json({ claimedRewards: 0, inviter });
}

// --- POST: mode: "free-sign" -> balikin v,r,s untuk claimFreeByFidSig
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (body?.mode !== "free-sign") {
    return NextResponse.json({ error: "unsupported body" }, { status: 400 });
  }

  const fid = BigInt(body?.fid ?? 0);
  const to = (body?.to ?? "").toLowerCase();
  const inviter = (body?.inviter ?? "0x0000000000000000000000000000000000000000").toLowerCase();
  if (!fid || !to || !/^0x[0-9a-fA-F]{40}$/.test(to)) {
    return NextResponse.json({ error: "missing/invalid fid/to" }, { status: 400 });
  }

  const wallet = getWallet();
  if (!wallet) {
    return NextResponse.json({ error: "FID_SIGNER_PK not configured" }, { status: 500 });
  }

  // --- SESUAIKAN bila domain/struct di kontrakmu beda ---
  const deadline = Math.floor(Date.now() / 1000) + 60 * 30; // 30 menit
  const domain: TypedDataDomain = {
    name: "RigSaleFlexible",
    version: "1",
    chainId: 84532,              // Base Sepolia
    verifyingContract: rigSaleAddress as `0x${string}`,
  };

  // struct yang diketik di Solidity harus match!
  const types = {
    FreeMint: [
      { name: "fid", type: "uint256" },
      { name: "to", type: "address" },
      { name: "inviter", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
  } as const;

  const message = { fid: fid.toString(), to, inviter, deadline };

  // Tanda tangan EIP-712
  const signature = await wallet.signTypedData(domain, types as any, message);
  const sig = Signature.from(signature); // ethers v6

  return NextResponse.json({
    fid: fid.toString(),
    to,
    inviter,
    deadline,
    v: sig.v,
    r: `0x${sig.r.toString(16).padStart(64, "0")}`,
    s: `0x${sig.s.toString(16).padStart(64, "0")}`,
  });
}

