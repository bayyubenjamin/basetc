"use client";

import { useState, useEffect } from "react";
import type { FC } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { baseSepolia } from "viem/chains";
import {
  rigSaleAddress,
  rigSaleABI,
  rigNftAddress,
  rigNftABI,
  chainId as BASE_CHAIN_ID,
} from "../lib/web3Config";

// Types for the supported tiers
type TierID = "basic" | "pro" | "legend";

interface NFTTier {
  id: TierID;
  name: string;
  image: string;
  hashrateHint: string;
  price: string;
  description: string;
}

const NFT_DATA: NFTTier[] = [
  { id: "basic",  name: "Basic Rig",  image: "/img/vga_basic.png",  hashrateHint: "~1.5 H/s",  price: "FREE", description: "Claim your first rig for free to start mining." },
  { id: "pro",    name: "Pro Rig",    image: "/img/vga_pro.png",    hashrateHint: "~5.0 H/s",  price: "TBA",  description: "Upgrade for a significant boost in hashrate." },
  { id: "legend", name: "Legend Rig", image: "/img/vga_legend.png", hashrateHint: "~25.0 H/s", price: "TBA",  description: "The ultimate rig for professional miners." },
];

export interface MarketProps { onTransactionSuccess?: () => void; }

const Market: FC<MarketProps> = ({ onTransactionSuccess }) => {
  const { address } = useAccount();
  const [message, setMessage] = useState<string>("");

  // Ambil BASIC id dari kontrak
  const basicId = useReadContract({
    address: rigNftAddress as `0x${string}`,
    abi: rigNftABI as any,
    functionName: "BASIC",
  });
  const BASIC_ID = basicId.data as bigint | undefined;

  // write hook + receipt
  const { writeContract, data: txHash, isPending, error } = useWriteContract();
  const { isLoading: waitingReceipt, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  // kirim referral setelah hash ada
  useEffect(() => {
    if (!txHash) return;
    (async () => {
      try {
        const info = await getFarcasterInfo();
        await fetch("/api/referral", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            userFid: info.fid,
            referrerFid: info.referrerFid,
            action: "claimBasic",
            tx: txHash,
          }),
        }).catch(() => {});
      } catch {}
    })();
  }, [txHash]);

  useEffect(() => {
    if (isSuccess) setMessage("Claim success!");
    if (error) {
      const err: any = error;
      setMessage(err?.shortMessage || err?.message || "Transaction failed");
    }
  }, [isSuccess, error]);

  // Farcaster helpers
  async function getFarcasterInfo(): Promise<{ fid: number | null; referrerFid: number | null }> {
    try {
      const mod = await import("@farcaster/miniapp-sdk");
      const rawCtx: any = (mod as any)?.sdk?.context;
      let ctx: any = null;
      if (typeof rawCtx === "function") ctx = await rawCtx.call((mod as any).sdk);
      else if (rawCtx && typeof rawCtx.then === "function") ctx = await rawCtx;
      else ctx = rawCtx ?? null;

      const fid: number | null = ctx?.user?.fid ?? null;
      const urlRefParam = new URL(window.location.href).searchParams.get("ref");
      const urlRef = urlRefParam ? Number(urlRefParam) : NaN;
      const stored = Number(localStorage.getItem("basetc_ref") || "0");
      const ref = [urlRef, stored].find((v) => !!v && !Number.isNaN(v)) ?? null;
      if (ref) localStorage.setItem("basetc_ref", String(ref));
      return { fid, referrerFid: (ref as number) ?? null };
    } catch {
      return { fid: null, referrerFid: null };
    }
  }

  const handleClaim = async () => {
    try {
      setMessage("");
      if (!address) return setMessage("Connect wallet first.");
      if (typeof BASIC_ID === "undefined") return setMessage("Fetching BASIC ID… try again.");

      // FREE mint via RigSale
      writeContract({
        address: rigSaleAddress as `0x${string}`,
        abi: rigSaleABI as any,
        functionName: "mintBySale",
        args: [address as `0x${string}`, BASIC_ID as bigint, 1n] as const,
        account: address as `0x${string}`,
        chain: baseSepolia,          // <-- penting
        chainId: BASE_CHAIN_ID,      // opsional
        // value: 0n,
      });

      onTransactionSuccess?.();
    } catch (err: any) {
      const msg = err?.shortMessage || err?.message || "Transaction failed";
      setMessage(msg);
    }
  };

  return (
    <div className="space-y-4 px-4 pt-4 pb-8">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Market</h1>
        <p className="text-sm text-neutral-400">Mint &amp; Listings</p>
      </header>

      <div className="space-y-4">
        {NFT_DATA.map((tier) => (
          <div key={tier.id} className="flex items-center bg-neutral-800 rounded-lg p-3 space-x-3">
            <div className="w-16 h-16 bg-neutral-700 rounded-md flex items-center justify-center">
              <span className="text-xs text-neutral-400">Img</span>
            </div>
            <div className="flex-1">
              <div className="flex items-baseline justify-between">
                <h3 className="font-semibold text-sm md:text-base">{tier.name}</h3>
                <span className="text-xs md:text-sm text-neutral-400">{tier.price}</span>
              </div>
              <p className="text-xs text-neutral-400 pt-0.5">{tier.description}</p>
              <p className="text-xs text-neutral-400 pt-0.5">Est. Hashrate: {tier.hashrateHint}</p>
            </div>
            <div>
              {tier.id === "basic" ? (
                <button
                  onClick={handleClaim}
                  disabled={!address || typeof BASIC_ID === "undefined" || isPending || waitingReceipt}
                  className="px-3 py-1.5 text-xs rounded-md bg-neutral-700 hover:bg-neutral-600 text-white disabled:bg-neutral-700 disabled:text-neutral-500"
                  title={!address ? "Connect wallet first" : undefined}
                >
                  {isPending || waitingReceipt ? "Claiming…" : "Claim Free Rig"}
                </button>
              ) : (
                <button disabled className="px-3 py-1.5 text-xs rounded-md bg-neutral-700 text-neutral-500">
                  Coming Soon
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {!!message && <p className="text-xs text-green-400">{message}</p>}
    </div>
  );
};

export default Market;

