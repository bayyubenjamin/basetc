"use client";

import { useState, useEffect } from "react";
import type { FC, ReactNode } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { baseSepolia } from "viem/chains";
import {
  rigNftAddress,
  rigNftABI,
  gameCoreAddress,
  gameCoreABI,
  chainId as BASE_CHAIN_ID,
} from "../lib/web3Config";
import Image from "next/image";

// Helper untuk mendapatkan FID Farcaster
async function getFarcasterFID(): Promise<bigint | null> {
  try {
    const mod = await import("@farcaster/miniapp-sdk");
    const rawCtx: any = (mod as any)?.sdk?.context;
    let ctx: any = null;
    if (typeof rawCtx === "function") ctx = await rawCtx.call((mod as any).sdk);
    else if (rawCtx && typeof rawCtx.then === "function") ctx = await rawCtx;
    else ctx = rawCtx ?? null;
    const fid: number | null = ctx?.user?.fid ?? null;
    return typeof fid === "number" && Number.isFinite(fid) ? BigInt(fid) : null;
  } catch {
    return null;
  }
}

// Komponen untuk menampilkan slot NFT
const NftSlot: FC<{ filled: boolean; tier: 'basic' | 'pro' | 'legend' }> = ({ filled, tier }) => {
  const tierImages = {
    basic: "/img/vga_basic.png",
    pro: "/img/vga_pro.gif",
    legend: "/img/vga_legend.gif",
  };

  return (
    <div className={`w-12 h-12 md:w-16 md:h-16 rounded-md flex items-center justify-center 
      ${filled ? 'bg-green-500/20 border-green-500/50' : 'bg-neutral-800 border-neutral-700'} border-2`}>
      {filled && <Image src={tierImages[tier]} alt={`${tier} rig`} width={48} height={48} className="object-contain" />}
    </div>
  );
};

// Komponen untuk setiap bagian merge (Basic, Pro, Legend)
const MergeSection: FC<{
  tierName: string;
  ownedCount: bigint;
  neededForUpgrade: bigint;
  slotCount: number;
  onMerge: () => void;
  isMerging: boolean;
  canMerge: boolean;
  imageSrc: string;
}> = ({ tierName, ownedCount, neededForUpgrade, slotCount, onMerge, isMerging, canMerge, imageSrc }) => (
  <div className="bg-neutral-800 rounded-lg p-4 space-y-3">
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold">{tierName} Rigs</h2>
        <p className="text-sm text-neutral-400">Owned: {String(ownedCount)}</p>
      </div>
      <div className="w-16 h-16 relative">
        <Image src={imageSrc} alt={`${tierName} rig`} layout="fill" objectFit="contain" />
      </div>
    </div>
    <div className="grid grid-cols-5 gap-2">
      {Array.from({ length: slotCount }).map((_, i) => (
        <NftSlot key={i} filled={i < Number(ownedCount)} tier={tierName.toLowerCase() as any} />
      ))}
    </div>
    {neededForUpgrade > 0n && (
      <button
        onClick={onMerge}
        disabled={!canMerge || isMerging}
        className={`w-full px-3 py-2 text-sm rounded-md transition-colors ${
          !canMerge || isMerging
            ? "bg-neutral-700 text-neutral-500 cursor-not-allowed"
            : "bg-blue-600 hover:bg-blue-500 text-white"
        }`}
      >
        {isMerging ? "Merging..." : `Merge ${String(neededForUpgrade)} for Pro`}
      </button>
    )}
  </div>
);

const Rakit: FC = () => {
  const { address } = useAccount();
  const [message, setMessage] = useState<string>("");

  const basicId = useReadContract({ address: rigNftAddress as `0x${string}`, abi: rigNftABI as any, functionName: "BASIC" });
  const proId   = useReadContract({ address: rigNftAddress as `0x${string}`, abi: rigNftABI as any, functionName: "PRO" });
  const legendId= useReadContract({ address: rigNftAddress as `0x${string}`, abi: rigNftABI as any, functionName: "LEGEND" });

  const BASIC  = basicId.data as bigint | undefined;
  const PRO    = proId.data as bigint | undefined;
  const LEGEND = legendId.data as bigint | undefined;

  const basicBal  = useReadContract({ address: rigNftAddress as `0x${string}`, abi: rigNftABI as any, functionName: "balanceOf",
    args: address && BASIC  !== undefined ? [address, BASIC]   : undefined, query: { enabled: Boolean(address && BASIC  !== undefined) }});
  const proBal    = useReadContract({ address: rigNftAddress as `0x${string}`, abi: rigNftABI as any, functionName: "balanceOf",
    args: address && PRO    !== undefined ? [address, PRO]     : undefined, query: { enabled: Boolean(address && PRO    !== undefined) }});
  const legendBal = useReadContract({ address: rigNftAddress as `0x${string}`, abi: rigNftABI as any, functionName: "balanceOf",
    args: address && LEGEND !== undefined ? [address, LEGEND]  : undefined, query: { enabled: Boolean(address && LEGEND !== undefined) }});

  const basicCount  = (basicBal.data as bigint | undefined)  ?? 0n;
  const proCount    = (proBal.data as bigint | undefined)    ?? 0n;
  const legendCount = (legendBal.data as bigint | undefined) ?? 0n;

  const needBasicToPro = useReadContract({ address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: "BASIC_TO_PRO_NEED" });
  const needProToLegend= useReadContract({ address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: "PRO_TO_LEGEND_NEED" });

  const needBP = (needBasicToPro.data as bigint | undefined) ?? 10n;
  const needPL = (needProToLegend.data as bigint | undefined) ?? 5n;

  const { writeContract, data: txHash, isPending, error } = useWriteContract();
  const { isLoading: waitingReceipt, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isSuccess) setMessage("Merge success!");
    if (error) {
      const err: any = error;
      setMessage(err?.shortMessage || err?.message || "Merge failed");
    }
  }, [isSuccess, error]);

  const handleMerge = async (mergeFunction: string, needed: bigint, fromTier: string, toTier: string) => {
    if (!address) return setMessage("Connect wallet first.");
    if (isPending || waitingReceipt) return;

    setMessage("");
    const fid = await getFarcasterFID();
    if (fid === null) return setMessage("Farcaster FID not found.");

    writeContract({
      address: gameCoreAddress as `0x${string}`,
      abi: gameCoreABI as any,
      functionName: mergeFunction,
      args: [address as `0x${string}`, fid as bigint] as const,
      account: address as `0x${string}`,
      chain: baseSepolia,
      chainId: BASE_CHAIN_ID,
    });
    setMessage(`Merging ${String(needed)} ${fromTier} → 1 ${toTier}…`);
  };

  const merging = isPending || waitingReceipt;

  return (
    <div className="space-y-4 px-4 pt-4 pb-8">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Workshop / Rakit</h1>
        <p className="text-sm text-neutral-400">Upgrade &amp; Merge your rigs</p>
      </header>

      <div className="space-y-4">
        <MergeSection
          tierName="Basic"
          ownedCount={basicCount}
          neededForUpgrade={needBP}
          slotCount={10}
          onMerge={() => handleMerge("mergeBasicToPro", needBP, "Basic", "Pro")}
          isMerging={merging}
          canMerge={!!address && basicCount >= needBP}
          imageSrc="/img/vga_basic.png"
        />

        <MergeSection
          tierName="Pro"
          ownedCount={proCount}
          neededForUpgrade={needPL}
          slotCount={5}
          onMerge={() => handleMerge("mergeProToLegend", needPL, "Pro", "Legend")}
          isMerging={merging}
          canMerge={!!address && proCount >= needPL}
          imageSrc="/img/vga_pro.png"
        />

        <MergeSection
          tierName="Legend"
          ownedCount={legendCount}
          neededForUpgrade={0n} // Tidak ada upgrade dari Legend di sini
          slotCount={3}
          onMerge={() => {}} // Tidak ada aksi merge
          isMerging={false}
          canMerge={false}
          imageSrc="/img/vga_legend.png"
        />
      </div>

      {!!message && <p className="text-xs text-green-400 pt-2 text-center">{message}</p>}
    </div>
  );
};

export default Rakit;
