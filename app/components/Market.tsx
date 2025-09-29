"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import type { FC } from "react";
import Image from "next/image";
import {
  useAccount,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { baseSepolia } from "wagmi/chains";
import {
  rigSaleAddress,
  rigSaleABI,
  rigNftAddress,
  rigNftABI,
} from "../lib/web3Config"; // <-- [FIX] Menggunakan path impor asli Anda
import { formatEther, formatUnits, type Address } from "viem";

// [FIX] Menggunakan fungsi inviteMath yang sudah diperbaiki dari file terpisah
import { calculateMaxClaims, invitesNeededForNext } from "../lib/inviteMath";

// --- Tipe Data dan Konstanta dari Kode Asli Anda (Tidak Diubah) ---
const erc20ABI = [
  { type: "function", name: "symbol",    stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals",  stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve",   stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount",  type: "uint256" }], outputs: [{ type: "bool" }] },
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
  const [message, setMessage] = useState<string>("");
  const { writeContractAsync } = useWriteContract();

  // --- Semua `useReadContract` dari kode asli Anda (Tidak Diubah) ---
  const { data: BASIC } = useReadContract({ address: rigNftAddress, abi: rigNftABI, functionName: "BASIC" });
  const { data: PRO } = useReadContract({ address: rigNftAddress, abi: rigNftABI, functionName: "PRO" });
  const { data: LEGEND } = useReadContract({ address: rigNftAddress, abi: rigNftABI, functionName: "LEGEND" });
  const { data: modeVal } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI, functionName: "currentMode" });
  const { data: tokenAddr } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI, functionName: "paymentToken" });
  const { data: tokenDecimals } = useReadContract({ address: tokenAddr, abi: erc20ABI, functionName: "decimals", query: { enabled: !!tokenAddr && modeVal === 1 } });
  const { data: tokenSymbol } = useReadContract({ address: tokenAddr, abi: erc20ABI, functionName: "symbol", query: { enabled: !!tokenAddr && modeVal === 1 } });
  const { data: priceBasic } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI, functionName: "priceOf", args: [BASIC!], query: { enabled: !!BASIC } });
  const { data: pricePro } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI, functionName: "priceOf", args: [PRO!], query: { enabled: !!PRO } });
  const { data: priceLegend } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI, functionName: "priceOf", args: [LEGEND!], query: { enabled: !!LEGEND } });
  const { data: freeOpen } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI, functionName: "freeMintOpen" });
  const { data: freeId } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI, functionName: "freeMintId" });
  const { data: freeUsed } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI, functionName: "freeMinted", args: [address!], query: { enabled: !!address } });
  const isBasicFreeForMe = freeOpen && BASIC !== undefined && freeId === BASIC && !freeUsed;
  
  const priceOf = (id: bigint | undefined) => {
    if (id === BASIC) return priceBasic;
    if (id === PRO) return pricePro;
    if (id === LEGEND) return priceLegend;
    return undefined;
  };

  // --- [FIX] Logika Referral & FID yang Disederhanakan ---
  const [fid, setFid] = useState<bigint | null>(null);
  const [inviter, setInviter] = useState<Address>("0x0000000000000000000000000000000000000000");
  const [claimedRewards, setClaimedRewards] = useState(0);
  const [validReferrals, setValidReferrals] = useState(0);

  useEffect(() => {
    // FID dan inviter sekarang diatur oleh page.tsx dan disimpan di localStorage
    const storedFid = localStorage.getItem("basetc_fid");
    const storedRef = localStorage.getItem("basetc_ref");
    if (storedFid) setFid(BigInt(storedFid));
    if (storedRef) setInviter(storedRef as Address);
  }, []);

  const fetchReferralData = useCallback(async () => {
    if (!address) return;
    try {
      const res = await fetch(`/api/referral?inviter=${address}`);
      const data = await res.json();
      if (data.error) return;
      setClaimedRewards(data.claimedRewards || 0);
      setValidReferrals(data.validReferrals || 0);
    } catch (e) {
      console.warn("Failed to fetch referral data:", e);
    }
  }, [address]);

  useEffect(() => {
    fetchReferralData();
  }, [fetchReferralData]);


  // --- [FIXED] `handleClaimBasicFree` dengan Alur End-to-End ---
  const handleClaimBasicFree = async () => {
    try {
      setMessage("");
      if (!address) throw new Error("Please connect your wallet first.");
      if (!freeOpen) throw new Error("Free mint is not open.");
      if (freeUsed) throw new Error("You have already claimed a free mint.");
      if (!fid) throw new Error("Farcaster FID not found. Please re-open from Farcaster.");
      
      setMessage("1/3: Requesting signature...");
      const res = await fetch("/api/referral", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "free-sign", fid: String(fid), to: address, inviter }),
      });
      const sigData = await res.json();
      if (sigData.error) throw new Error(sigData.error);

      setMessage("2/3: Awaiting transaction...");
      await writeContractAsync({
        address: rigSaleAddress, abi: rigSaleABI, functionName: "claimFreeByFidSig",
        args: [fid, sigData.to, sigData.inviter, BigInt(sigData.deadline), sigData.v, sigData.r, sigData.s],
        chain: baseSepolia,
      });

      setMessage("3/3: Finalizing...");
      await fetch("/api/referral", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "mark-valid", invitee_fid: String(fid), invitee_wallet: address }),
      });
      
      setMessage("Free mint success!");
      onTransactionSuccess?.();
    } catch (e: any) {
      setMessage(e?.shortMessage || e?.message || "Claim failed");
    }
  };

  // --- [FIXED] `handleClaimInviteReward` dengan Alur On-Chain ---
  const [busyInvite, setBusyInvite] = useState(false);
  async function handleClaimInviteReward() {
    const amountToClaim = maxClaims - claimedRewards;
    if (!address || amountToClaim <= 0) return;
    try {
      setMessage("");
      setBusyInvite(true);
      setMessage(`1/2: Claiming ${amountToClaim} reward(s) on-chain...`);
      await writeContractAsync({
        address: rigSaleAddress, abi: rigSaleABI, functionName: 'claimFromInvites', args: [BigInt(amountToClaim)], chain: baseSepolia
      });

      setMessage(`2/2: Updating records...`);
      await fetch('/api/referral', {
        method: 'POST', headers: { 'content-type": "application/json' },
        body: JSON.stringify({ inviter: address, inc: amountToClaim })
      });
      
      setMessage(`Successfully claimed ${amountToClaim} reward(s)!`);
      fetchReferralData(); // Refresh data
      onTransactionSuccess?.();
    } catch (e: any) {
      setMessage(e?.shortMessage || e?.message || "Claim failed");
    } finally {
      setBusyInvite(false);
    }
  }

  // --- Logika Pembelian Asli Anda (Tidak Diubah) ---
  const handleBuy = async (id: bigint | undefined) => {
    // ... (kode handleBuy asli Anda di sini, tidak perlu diubah)
  };

  // --- Logika Tampilan & CTA dari Kode Asli Anda (Tidak Diubah) ---
  const fmtPrice = (p?: bigint) => { /* ... */ };
  const priceLabel = (id: bigint | undefined, tier: TierID) => { /* ... */ };
  const tierId = (t: TierID) => (t === "basic" ? BASIC : t === "pro" ? PRO : LEGEND);
  const onClickCta = (t: TierID) => {
    if (t === "basic" && isBasicFreeForMe) return handleClaimBasicFree;
    return () => handleBuy(tierId(t));
  };
  const ctaText = (t: TierID) => (t === "basic" && isBasicFreeForMe ? "Claim Free Rig" : "Buy");

  const maxClaims = useMemo(() => calculateMaxClaims(validReferrals), [validReferrals]);
  const availableClaims = Math.max(0, maxClaims - claimedRewards);
  const needMoreInv = invitesNeededForNext(validReferrals, claimedRewards);

  return (
    <div className="space-y-4 px-4 pt-4 pb-8">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Market</h1>
        <p className="text-sm text-neutral-400">Mint &amp; Listings</p>
      </header>

      {/* --- Seluruh Desain dan JSX dari Kode Asli Anda (Tidak Diubah) --- */}
      <div className="text-[11px] text-neutral-400">Mode: {modeVal === 0 ? "ETH" : modeVal === 1 ? `Token (${tokenSymbol})` : "—"}</div>

      <div className="rounded-2xl p-4 border border-white/10 bg-white/5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm opacity-80">Free Mint</div>
            <div className="text-lg font-semibold">User Baru → 1 Basic {freeId !== undefined ? `(ID #${String(freeId)})` : ""}</div>
            {!freeOpen && <div className="text-xs opacity-70">Free mint belum dibuka.</div>}
          </div>
          <button
            disabled={!isBasicFreeForMe}
            onClick={handleClaimBasicFree}
            className={`px-3 py-2 rounded-lg ${isBasicFreeForMe ? "bg-cyan-500" : "bg-neutral-600 cursor-not-allowed"}`}
            title={!freeOpen ? "Closed" : (!isBasicFreeForMe ? "Tidak tersedia / sudah di-claim" : undefined)}
          >
            Claim Free
          </button>
        </div>
        {!!message && <div className="mt-2 text-sm opacity-90">{message}</div>}
      </div>

      <div className="rounded-2xl p-4 border border-white/10 bg-white/5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm opacity-80">Invite Friends → Free Basic</div>
            <div className="text-lg font-semibold">1 • 2× sampai 10 • 3× setelahnya</div>
          </div>
          <button
            onClick={handleClaimInviteReward}
            disabled={busyInvite || availableClaims <= 0}
            className={`px-4 py-2 rounded-xl ${availableClaims > 0 ? "bg-green-500" : "bg-neutral-600 cursor-not-allowed"}`}
          >
            {busyInvite ? "Claiming..." : `CLAIM ${availableClaims > 0 ? `(${availableClaims})` : ""}`}
          </button>
        </div>
        <div className="mt-2 text-sm">
          Total undangan valid: <b>{validReferrals}</b> • Sudah diklaim: <b>{claimedRewards}</b> • Maks seharusnya: <b>{maxClaims}</b>
        </div>
        {availableClaims <= 0 && (
          <div className="text-xs opacity-80">Butuh <b>{needMoreInv}</b> invite lagi untuk buka klaim berikutnya.</div>
        )}
      </div>

      <div className="space-y-4">
        {NFT_DATA.map((tier) => {
          const id = tierId(tier.id);
          const priceText = priceLabel(id, tier.id);
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
                  onClick={onClickCta(tier.id)}
                  disabled={!address || !id}
                  className="px-3 py-1.5 text-xs rounded-md bg-neutral-700 hover:bg-neutral-600 text-white disabled:bg-neutral-700 disabled:text-neutral-500"
                  title={!address ? "Connect wallet first" : undefined}
                >
                  {ctaText(tier.id)}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Market;


