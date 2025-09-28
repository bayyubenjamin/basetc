"use client";

import { useState, useEffect, useMemo } from "react";
import type { FC } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { baseSepolia } from "viem/chains";
import { formatUnits } from "viem";
import {
  rigNftAddress,
  rigNftABI,
  gameCoreAddress,
  gameCoreABI,
  chainId as BASE_CHAIN_ID,
} from "../lib/web3Config";
import Image from "next/image";

// ===== Farcaster FID helper (sama seperti file asli) =====
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

// ===== Minimal ERC20 ABI untuk approve fee token =====
const erc20Abi = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "symbol",   stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{type:"address"},{type:"address"}], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve",  stateMutability: "nonpayable", inputs: [{type:"address"},{type:"uint256"}], outputs: [{ type: "bool" }] },
] as const;

// ===== Slot tile (PERSIS struktur asli) =====
const NftSlot: FC<{ filled: boolean; tier: "basic" | "pro" | "legend" }> = ({ filled, tier }) => {
  const tierImages = {
    basic: "/img/vga_basic.png",
    pro: "/img/vga_pro.gif",
    legend: "/img/vga_legend.gif",
  } as const;

  return (
    <div
      className={`w-12 h-12 md:w-16 md:h-16 rounded-md flex items-center justify-center 
      ${filled ? "bg-green-500/20 border-green-500/50" : "bg-neutral-800 border-neutral-700"} border-2`}
    >
      {filled && (
        <Image
          src={tierImages[tier]}
          alt={`${tier} rig`}
          width={48}
          height={48}
          className="object-contain"
        />
      )}
    </div>
  );
};

// ===== Section (PERSIS layout asli) =====
const MergeSection: FC<{
  tierName: string;
  ownedCount: bigint;
  neededForUpgrade: bigint;
  slotCount: number;
  onMerge: () => void;
  isMerging: boolean;
  canMerge: boolean;
  imageSrc: string;
}> = ({
  tierName,
  ownedCount,
  neededForUpgrade,
  slotCount,
  onMerge,
  isMerging,
  canMerge,
  imageSrc,
}) => (
  <div className="bg-neutral-800 rounded-lg p-4 space-y-3">
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold">{tierName} Rigs</h2>
        <p className="text-sm text-neutral-400">Owned: {String(ownedCount)}</p>
      </div>
      <div className="w-16 h-16 relative">
        <Image
          src={imageSrc}
          alt={`${tierName} rig`}
          width={64}
          height={64}
          className="object-contain"
        />
      </div>
    </div>

    <div className="grid grid-cols-5 gap-2">
      {Array.from({ length: slotCount }).map((_, i) => (
        <NftSlot
          key={i}
          filled={i < Number(ownedCount)}
          tier={tierName.toLowerCase() as any}
        />
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
        {isMerging
          ? "Merging..."
          : tierName === "Basic"
          ? `Merge ${String(neededForUpgrade)} for Pro`
          : `Merge ${String(neededForUpgrade)} for Legend`}
      </button>
    )}
  </div>
);

// ===== Halaman utama (DESAIN ASLI) =====
const Rakit: FC = () => {
  const { address, chainId } = useAccount();
  const [message, setMessage] = useState<string>("");

  const user = address as `0x${string}` | undefined;
  const onBase = !chainId || chainId === BASE_CHAIN_ID;

  // --- NFT IDs & balances (seperti asli) ---
  const basicId = useReadContract({
    address: rigNftAddress as `0x${string}`,
    abi: rigNftABI as any,
    functionName: "BASIC",
  });
  const proId = useReadContract({
    address: rigNftAddress as `0x${string}`,
    abi: rigNftABI as any,
    functionName: "PRO",
  });
  const legendId = useReadContract({
    address: rigNftAddress as `0x${string}`,
    abi: rigNftABI as any,
    functionName: "LEGEND",
  });

  const BASIC = basicId.data as bigint | undefined;
  const PRO = proId.data as bigint | undefined;
  const LEGEND = legendId.data as bigint | undefined;

  const basicBal = useReadContract({
    address: rigNftAddress as `0x${string}`,
    abi: rigNftABI as any,
    functionName: "balanceOf",
    args: address && BASIC !== undefined ? [address, BASIC] : undefined,
    query: { enabled: Boolean(address && BASIC !== undefined) },
  });
  const proBal = useReadContract({
    address: rigNftAddress as `0x${string}`,
    abi: rigNftABI as any,
    functionName: "balanceOf",
    args: address && PRO !== undefined ? [address, PRO] : undefined,
    query: { enabled: Boolean(address && PRO !== undefined) },
  });
  const legendBal = useReadContract({
    address: rigNftAddress as `0x${string}`,
    abi: rigNftABI as any,
    functionName: "balanceOf",
    args: address && LEGEND !== undefined ? [address, LEGEND] : undefined,
    query: { enabled: Boolean(address && LEGEND !== undefined) },
  });

  const basicCount = (basicBal.data as bigint | undefined) ?? 0n;
  const proCount = (proBal.data as bigint | undefined) ?? 0n;
  const legendCount = (legendBal.data as bigint | undefined) ?? 0n;

  // --- GameCore: needs, caps, usage (untuk logic merge) ---
  const needBasicToPro = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "BASIC_TO_PRO_NEED",
  });
  const needProToLegend = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "PRO_TO_LEGEND_NEED",
  });
  const rigCaps = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "rigCaps",
  });
  // usage untuk cek slot terpakai
  const usageRead = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "miningUsage",
    args: user ? [user] : undefined,
    query: { enabled: Boolean(user) },
  });

  const needBP = (needBasicToPro.data as bigint | undefined) ?? 10n;
  const needPL = (needProToLegend.data as bigint | undefined) ?? 5n;

  const caps = useMemo(() => {
    const rc = rigCaps.data as { b: bigint; p: bigint; l: bigint } | undefined;
    return {
      b: Number(rc?.b ?? 10n),
      p: Number(rc?.p ?? 5n),
      l: Number(rc?.l ?? 3n),
    };
  }, [rigCaps.data]);

  const usedPro = useMemo(() => Number(((usageRead.data as bigint[] | undefined)?.[4] ?? 0n)), [usageRead.data]);
  const usedLegend = useMemo(() => Number(((usageRead.data as bigint[] | undefined)?.[7] ?? 0n)), [usageRead.data]);

  // --- Fee token & allowance (untuk approve otomatis via tombol "Merge") ---
  const feeBasicToPro = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "feeBasicToPro",
  });
  const feeProToLegend = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "feeProToLegend",
  });
  const feeTokenAddr = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "mergeFeeToken",
  });
  const feeToken = (feeTokenAddr.data as `0x${string}` | undefined) ?? undefined;

  const feeDecimals = useReadContract({
    address: feeToken,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: Boolean(feeToken) },
  });
  const feeSymbol = useReadContract({
    address: feeToken,
    abi: erc20Abi,
    functionName: "symbol",
    query: { enabled: Boolean(feeToken) },
  });
  const allowance = useReadContract({
    address: feeToken,
    abi: erc20Abi,
    functionName: "allowance",
    args: user ? [user, gameCoreAddress as `0x${string}`] : undefined,
    query: { enabled: Boolean(user && feeToken) },
  });

  const feeTokSym = (feeSymbol.data as string | undefined) ?? "FEE";
  const feeDec = (feeDecimals.data as number | undefined) ?? 18;

  const rawFeeB2P = (feeBasicToPro.data as bigint | undefined) ?? 0n;
  const rawFeeP2L = (feeProToLegend.data as bigint | undefined) ?? 0n;
  const rawAllowance = (allowance.data as bigint | undefined) ?? 0n;

  // apakah slot tujuan tersedia?
  const proSlotAvailable = usedPro < caps.p;
  const legendSlotAvailable = usedLegend < caps.l;
  const legendAtLimit = Number(legendCount) >= caps.l; // per-wallet limit = caps.l

  // --- TX hooks (dipakai untuk approve otomatis) ---
  const { writeContract, data: txHash, isPending, error } = useWriteContract();
  const { isLoading: waitingReceipt, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isSuccess) setMessage("Transaction confirmed.");
    if (error) {
      const err: any = error;
      setMessage(err?.shortMessage || err?.message || "Transaction failed");
    }
  }, [isSuccess, error]);

  const merging = isPending || waitingReceipt;

  // ===== Handler merge (desain tetap 1 tombol) =====
  async function handleMerge(kind: "BASIC_TO_PRO" | "PRO_TO_LEGEND", needed: bigint, fromTier: string, toTier: string) {
    if (!user) return setMessage("Connect wallet first.");
    if (!onBase) return setMessage("Switch network to Base Sepolia.");

    // Syarat-slot tambahan (tidak mengubah UI)
    if (kind === "BASIC_TO_PRO") {
      if (basicCount < needBP) return setMessage(`Butuh ${String(needBP)} Basic untuk merge.`);
      if (!proSlotAvailable) return setMessage("Pro slot penuh. Merge dinonaktifkan agar hasil terpakai.");
    } else {
      if (proCount < needPL) return setMessage(`Butuh ${String(needPL)} Pro untuk merge.`);
      if (!legendSlotAvailable) return setMessage("Legend slot penuh. Merge dinonaktifkan agar hasil terpakai.");
      if (legendAtLimit) return setMessage(`Legend per wallet telah mencapai limit (${caps.l}).`);
    }

    // Ambil FID (sesuai pola asli)
    const fid = await getFarcasterFID();
    if (fid === null) return setMessage("Farcaster FID not found.");

    // Cek & minta approve otomatis jika allowance < fee
    const feeNeeded = kind === "BASIC_TO_PRO" ? rawFeeB2P : rawFeeP2L;
    if (feeToken && feeNeeded > 0n && rawAllowance < feeNeeded) {
      setMessage(`Approving ${formatUnits(feeNeeded, feeDec)} ${feeTokSym}...`);
      try {
        // kirim approve (user konfirmasi di wallet)
        await writeContract({
          address: feeToken,
          abi: erc20Abi,
          functionName: "approve",
          args: [gameCoreAddress as `0x${string}`, feeNeeded],
          account: user,
          chain: baseSepolia,
        });
        // user perlu klik Merge lagi setelah approve terkonfirmasi
        return;
      } catch (e: any) {
        return setMessage(e?.shortMessage || e?.message || "Approve failed");
      }
    }

    // Panggil backend relayer /api/merge (server punya RELAYER_ROLE)
    try {
      setMessage("Submitting merge request...");
      const resp = await fetch("/api/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, kind, fid: Number(fid) }),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        return setMessage(`Server rejected: ${txt}`);
      }
      const { ok, tx, error: svErr } = await resp.json();
      if (!ok) return setMessage(svErr || "Merge failed on server");
      setMessage(`Merge submitted: ${tx}`);
    } catch (e: any) {
      setMessage(e?.message || "Network error");
    }
  }

  return (
    <div className="space-y-4 px-4 pt-4 pb-8">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Workshop / Rakit</h1>
        <p className="text-sm text-neutral-400">Upgrade &amp; Merge your rigs</p>
      </header>

      <div className="space-y-4">
        {/* Basic -> Pro */}
        <MergeSection
          tierName="Basic"
          ownedCount={basicCount}
          neededForUpgrade={needBP}
          slotCount={caps.b} // pakai caps dari kontrak
          onMerge={() =>
            handleMerge("BASIC_TO_PRO", needBP, "Basic", "Pro")
          }
          isMerging={merging}
          canMerge={!!address && basicCount >= needBP}
          imageSrc="/img/vga_basic.png"
        />

        {/* Pro -> Legend */}
        <MergeSection
          tierName="Pro"
          ownedCount={proCount}
          neededForUpgrade={needPL}
          slotCount={caps.p}
          onMerge={() =>
            handleMerge("PRO_TO_LEGEND", needPL, "Pro", "Legend")
          }
          isMerging={merging}
          canMerge={!!address && proCount >= needPL}
          imageSrc="/img/vga_pro.gif"
        />

        {/* Legend (no further upgrade) */}
        <MergeSection
          tierName="Legend"
          ownedCount={legendCount}
          neededForUpgrade={0n}
          slotCount={caps.l}
          onMerge={() => {}}
          isMerging={false}
          canMerge={false}
          imageSrc="/img/vga_legend.gif"
        />
      </div>

      {!!message && (
        <p className="text-xs text-green-400 pt-2 text-center">{message}</p>
      )}
    </div>
  );
};

export default Rakit;

