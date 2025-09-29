"use client";

import { useEffect, useMemo, useState } from "react";
import type { FC } from "react";
import Image from "next/image";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  usePublicClient
} from "wagmi";
import { baseSepolia } from "wagmi/chains";
import {
  rigSaleAddress,
  rigSaleABI,
  rigNftAddress,
  rigNftABI,
} from "../lib/web3Config";
import { formatEther, formatUnits, type Address } from "viem";

/* =============================
    Invite Math (original logic preserved)
============================= */
function maxClaimsFrom(totalInvites: number): number {
  if (totalInvites <= 0) return 0;
  if (totalInvites <= 10) return 1 + Math.floor(Math.max(0, totalInvites - 1) / 2);
  return 5 + Math.floor((totalInvites - 10) / 3);
}
function invitesNeededForNext(totalInvites: number, claimed: number): number {
  const nowMax = maxClaimsFrom(totalInvites);
  if (claimed < nowMax) return 0;
  let t = totalInvites;
  while (maxClaimsFrom(t) < claimed + 1) t++;
  return t - totalInvites;
}

// ERC20 minimal ABI (original logic preserved)
const erc20ABI = [
  { type: "function", name: "symbol",    stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals",  stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ], outputs: [{ type: "uint256" }]
  },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [
      { name: "spender", type: "address" },
      { name: "amount",  type: "uint256" },
    ], outputs: [{ type: "bool" }]
  },
] as const;

type TierID = "basic" | "pro" | "legend";
interface NFTTier {
  id: TierID;
  name: string;
  image: string;
  hashrateHint: string;
  description: string;
}
const NFT_DATA: NFTTier[] = [
  { id: "basic",  name: "Basic Rig",  image: "/img/vga_basic.png",  hashrateHint: "~1.5 H/s",  description: "Claim your first rig for free to start mining." },
  { id: "pro",    name: "Pro Rig",    image: "/img/vga_pro.gif",    hashrateHint: "~5.0 H/s",  description: "Upgrade for a significant boost in hashrate." },
  { id: "legend", name: "Legend Rig", image: "/img/vga_legend.gif", hashrateHint: "~25.0 H/s", description: "The ultimate rig for professional miners." },
];

export interface MarketProps { onTransactionSuccess?: () => void; }

const Market: FC<MarketProps> = ({ onTransactionSuccess }) => {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // ----- Ambil ID tier dari RigNFT -----
  const { data: BASIC } = useReadContract({ address: rigNftAddress, abi: rigNftABI as any, functionName: "BASIC" });
  const { data: PRO } = useReadContract({ address: rigNftAddress, abi: rigNftABI as any, functionName: "PRO" });
  const { data: LEGEND } = useReadContract({ address: rigNftAddress, abi: rigNftABI as any, functionName: "LEGEND" });

  // ----- Harga aktif per ID -----
  const { data: priceBasic } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "priceOf", args: [BASIC], query: { enabled: !!BASIC } });
  const { data: pricePro } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "priceOf", args: [PRO], query: { enabled: !!PRO } });
  const { data: priceLegend } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "priceOf", args: [LEGEND], query: { enabled: !!LEGEND } });

  // ===== Ambil FID & inviter: URL -> localStorage (fallback) =====
  // Logic ini dibuat lebih sederhana karena `page.tsx` sudah menangani Farcaster context & auto-upsert.
  const [fid, setFid] = useState<bigint | null>(null);
  const [inviter, setInviter] = useState<Address>("0x0000000000000000000000000000000000000000");

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const qFid = url.searchParams.get("fid") || localStorage.getItem("basetc_fid");
      if (qFid && /^\d+$/.test(qFid)) setFid(BigInt(qFid));

      const qRef = url.searchParams.get("ref") || localStorage.getItem("basetc_ref");
      if (qRef && /^0x[0-9a-fA-F]{40}$/.test(qRef)) setInviter(qRef as Address);
    } catch {}
  }, []);

  // ----- Free mint status -----
  const { data: freeOpen } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "freeMintOpen" });
  const { data: freeId } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "freeMintId" });
  const { data: freeUsed, refetch: refetchFreeUsed } = useReadContract({
    address: rigSaleAddress, abi: rigSaleABI as any, functionName: "freeMintedByFid",
    args: fid ? [fid] : undefined,
    query: { enabled: !!fid },
  });
  const isBasicFreeForMe = freeOpen && BASIC !== undefined && freeId === BASIC && !freeUsed;

  // ----- Writer -----
  const { writeContractAsync } = useWriteContract();

  /* ============================
      Handlers
  ============================ */

  // Claim Free: pakai claimFreeByFidSig (signature dari backend /api/referral)
  const handleClaimBasicFree = async () => {
    setLoading(true);
    setMessage("");
    try {
      if (!address) throw new Error("Please connect your wallet first.");
      if (!isBasicFreeForMe) throw new Error("You are not eligible for a free mint.");
      if (!fid) throw new Error("Farcaster FID not found. Please use the app within Farcaster or provide ?fid=... in the URL.");

      setMessage("1/3: Requesting signature from server...");
      const sigResponse = await fetch("/api/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "free-sign", fid: String(fid), to: address, inviter }),
      });
      if (!sigResponse.ok) {
        const err = await sigResponse.json();
        throw new Error(err.error || "Failed to get signature from server.");
      }
      const sigData = await sigResponse.json();

      setMessage("2/3: Awaiting transaction confirmation...");
      const txHash = await writeContractAsync({
        address: rigSaleAddress,
        abi: rigSaleABI as any,
        functionName: "claimFreeByFidSig",
        args: [fid, address, sigData.inviter, BigInt(sigData.deadline), sigData.v, sigData.r, sigData.s],
        account: address,
        chain: baseSepolia,
      });
      await publicClient?.waitForTransactionReceipt({ hash: txHash });

      setMessage("3/3: Transaction successful! Updating referral status...");
      if (inviter !== "0x0000000000000000000000000000000000000000") {
        await fetch("/api/referral", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // FIX: Changed 'action' to 'mode' to match the updated API route
          body: JSON.stringify({ mode: "mark-valid", inviter, invitee_fid: String(fid), invitee_wallet: address }),
        });
      }

      setMessage("Claim successful!");
      refetchFreeUsed();
      onTransactionSuccess?.();

    } catch (e: any) {
      const errorMsg = e?.shortMessage || e?.message || "An unknown error occurred.";
      setMessage(`Error: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  // handleBuy logic from original code is preserved
  const handleBuy = async (id: bigint, price: bigint) => {
    setLoading(true);
    setMessage("");
    try {
      if (!address) throw new Error("Please connect your wallet first.");
      setMessage("Awaiting transaction confirmation...");
      const txHash = await writeContractAsync({
        address: rigSaleAddress,
        abi: rigSaleABI as any,
        functionName: "buyWithETH",
        args: [id, 1n],
        value: price,
        account: address,
        chain: baseSepolia,
      });
      await publicClient?.waitForTransactionReceipt({ hash: txHash });
      setMessage("Purchase successful!");
      onTransactionSuccess?.();
    } catch (e: any) {
      const errorMsg = e?.shortMessage || e?.message || "An unknown error occurred.";
      setMessage(`Error: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const ctaText = (t: TierID) => (t === "basic" && isBasicFreeForMe ? "Claim Free" : "Buy");

  /* ============================
      Render (Using original UI structure)
  ============================ */
  return (
    <div className="space-y-4 px-4 pt-4 pb-8">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Market</h1>
        <p className="text-sm text-neutral-400">Mint new mining rigs to boost your hashrate.</p>
      </header>
      
      {/* Listing NFT */}
      <div className="space-y-4">
        {NFT_DATA.map((tier) => {
          const id = tier.id === 'basic' ? BASIC : tier.id === 'pro' ? PRO : LEGEND;
          const price = tier.id === 'basic' ? priceBasic : tier.id === 'pro' ? pricePro : LEGEND;
          const isFree = tier.id === 'basic' && isBasicFreeForMe;
          const buttonDisabled = loading || !address || (isFree ? false : !price);
          const priceText = isFree ? "FREE" : (price ? `${formatEther(price as bigint)} ETH` : 'N/A');

          return (
            <div key={tier.id} className="flex items-center bg-neutral-800 rounded-lg p-3 space-x-3">
              <div className="w-16 h-16 bg-neutral-700 rounded-md flex items-center justify-center relative overflow-hidden">
                <Image src={tier.image} alt={tier.name} width={64} height={64} className="object-contain" />
              </div>
              <div className="flex-1">
                <div className="flex items-baseline justify-between">
                  <h3 className="font-semibold text-sm md:text-base">{tier.name}</h3>
                  <span className="text-xs md:text-sm text-neutral-400">{priceText}</span>
                </div>
                <p className="text-xs text-neutral-400 pt-0.5">{tier.description}</p>
                 <p className="text-xs text-neutral-400 pt-0.5">Est. Hashrate: {tier.hashrateHint}</p>
              </div>
              <div>
                <button
                  onClick={() => isFree ? handleClaimBasicFree() : handleBuy(id as bigint, price as bigint)}
                  disabled={buttonDisabled}
                  className="px-3 py-1.5 text-xs rounded-md bg-blue-600 hover:bg-blue-500 text-white disabled:bg-neutral-700 disabled:text-neutral-500 disabled:cursor-not-allowed"
                >
                  {ctaText(tier.id)}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {message && <p className="text-center text-sm text-neutral-300 mt-4 break-all">{message}</p>}
    </div>
  );
};

export default Market;


