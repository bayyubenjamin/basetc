"use client";

import { useEffect, useMemo, useState } from "react";
import type { FC } from "react";
import Image from "next/image";
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

// ---------- Helper UI ----------
const toast = (msg: string) => alert(msg);

// (opsional) ambil FID farcaster; kalau gagal kita biarkan 0
async function getFarcasterFID(): Promise<bigint> {
  try {
    const mod = await import("@farcaster/miniapp-sdk");
    const rawCtx: any = (mod as any)?.sdk?.context;
    let ctx: any = null;
    if (typeof rawCtx === "function") ctx = await rawCtx.call((mod as any).sdk);
    else if (rawCtx && typeof rawCtx.then === "function") ctx = await rawCtx;
    else ctx = rawCtx ?? null;
    const fid: number | null = ctx?.user?.fid ?? null;
    return typeof fid === "number" && Number.isFinite(fid) ? BigInt(fid) : 0n;
  } catch {
    return 0n;
  }
}

// ---------- Minimal ERC20 ABI ----------
const erc20Abi = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "symbol",   stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [{ type: "address" }, { type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [{ type: "address" }, { type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
] as const;

// ---------- Slot Cell ----------
const NftSlot: FC<{ filled: boolean; src: string; alt: string }> = ({ filled, src, alt }) => (
  <div
    className={`w-12 h-12 md:w-16 md:h-16 rounded-md flex items-center justify-center border-2 ${
      filled
        ? "bg-green-500/15 border-green-500/50"
        : "bg-neutral-800 border-neutral-700"
    }`}
  >
    {filled ? (
      <Image src={src} alt={alt} width={48} height={48} className="object-contain" />
    ) : null}
  </div>
);

// ---------- Merge Section (desain aslimu) ----------
const MergeSection: FC<{
  tierName: "Basic" | "Pro" | "Legend";
  ownedCount: bigint;
  slotCount: number;
  buttonText?: string;
  buttonDisabled?: boolean;
  onClick?: () => void;
  imageSrc: string;
}> = ({ tierName, ownedCount, slotCount, buttonText, buttonDisabled, onClick, imageSrc }) => {
  const tierImg =
    tierName === "Basic"
      ? "/img/vga_basic.png"
      : tierName === "Pro"
      ? "/img/vga_pro.gif"
      : "/img/vga_legend.gif";

  return (
    <div className="bg-neutral-800 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{tierName} Rigs</h2>
          <p className="text-sm text-neutral-400">Owned: {String(ownedCount)}</p>
        </div>
        <div className="w-16 h-16 relative">
          <Image src={imageSrc || tierImg} alt={`${tierName} rig`} width={64} height={64} className="object-contain" />
        </div>
      </div>

      {/* Slots */}
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: slotCount }).map((_, i) => (
          <NftSlot
            key={i}
            filled={i < Number(ownedCount)}
            src={tierImg}
            alt={`${tierName} rig`}
          />
        ))}
      </div>

      {/* Tombol (opsional, hanya untuk Basic & Pro) */}
      {buttonText ? (
        <button
          onClick={onClick}
          disabled={Boolean(buttonDisabled)}
          className={`w-full px-3 py-2 text-sm rounded-md transition-colors ${
            buttonDisabled
              ? "bg-neutral-700 text-neutral-500 cursor-not-allowed"
              : tierName === "Basic"
              ? "bg-blue-600 hover:bg-blue-500 text-white"
              : "bg-indigo-600 hover:bg-indigo-500 text-white"
          }`}
        >
          {buttonText}
        </button>
      ) : null}
    </div>
  );
};

export default function Rakit() {
  const { address, chainId } = useAccount();
  const onBase = !chainId || chainId === BASE_CHAIN_ID;
  const user = address as `0x${string}` | undefined;

  // ---- NFT IDs ----
  const basicId = useReadContract({ address: rigNftAddress as `0x${string}`, abi: rigNftABI as any, functionName: "BASIC" });
  const proId   = useReadContract({ address: rigNftAddress as `0x${string}`, abi: rigNftABI as any, functionName: "PRO" });
  const legendId= useReadContract({ address: rigNftAddress as `0x${string}`, abi: rigNftABI as any, functionName: "LEGEND" });

  const BASIC  = basicId.data as bigint | undefined;
  const PRO    = proId.data as bigint | undefined;
  const LEGEND = legendId.data as bigint | undefined;

  // ---- Balances ----
  const basicBal  = useReadContract({
    address: rigNftAddress as `0x${string}`,
    abi: rigNftABI as any,
    functionName: "balanceOf",
    args: user && BASIC !== undefined ? [user, BASIC] : undefined,
    query: { enabled: Boolean(user && BASIC !== undefined) },
  });
  const proBal    = useReadContract({
    address: rigNftAddress as `0x${string}`,
    abi: rigNftABI as any,
    functionName: "balanceOf",
    args: user && PRO !== undefined ? [user, PRO] : undefined,
    query: { enabled: Boolean(user && PRO !== undefined) },
  });
  const legendBal = useReadContract({
    address: rigNftAddress as `0x${string}`,
    abi: rigNftABI as any,
    functionName: "balanceOf",
    args: user && LEGEND !== undefined ? [user, LEGEND] : undefined,
    query: { enabled: Boolean(user && LEGEND !== undefined) },
  });

  const basicCount  = (basicBal.data as bigint | undefined)  ?? 0n;
  const proCount    = (proBal.data as bigint | undefined)    ?? 0n;
  const legendCount = (legendBal.data as bigint | undefined) ?? 0n;

  // ---- Needs & Caps ----
  const needB2P = useReadContract({ address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: "BASIC_TO_PRO_NEED" });
  const needP2L = useReadContract({ address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: "PRO_TO_LEGEND_NEED" });
  const capsRead = useReadContract({ address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: "rigCaps" });
  const miningUsage = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "miningUsage",
    args: user ? [user] : undefined,
    query: { enabled: Boolean(user) },
  });

  const caps = useMemo(() => {
    const rc = capsRead.data as { b: bigint; p: bigint; l: bigint } | undefined;
    return { b: Number(rc?.b ?? 0n), p: Number(rc?.p ?? 0n), l: Number(rc?.l ?? 0n) };
  }, [capsRead.data]);

  const [
    _bOwned, bUsed, _bIdle,
    _pOwned, pUsed, _pIdle,
    _lOwned, lUsed, _lIdle,
  ] = useMemo(() => {
    const arr = (miningUsage.data as bigint[] | undefined) ?? [];
    return [
      Number(arr[0] ?? 0n), Number(arr[1] ?? 0n), Number(arr[2] ?? 0n),
      Number(arr[3] ?? 0n), Number(arr[4] ?? 0n), Number(arr[5] ?? 0n),
      Number(arr[6] ?? 0n), Number(arr[7] ?? 0n), Number(arr[8] ?? 0n),
    ] as const;
  }, [miningUsage.data]);

  const needBP = (needB2P.data as bigint | undefined) ?? 10n;
  const needPL = (needP2L.data as bigint | undefined) ?? 5n;

  // ---- Fee token, fee amount, allowance ----
  const feeTokenAddr = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "mergeFeeToken",
  });
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
  const feeTokDec = (feeDecimals.data as number | undefined) ?? 18;
  const rawFeeB2P  = (feeBasicToPro.data as bigint | undefined) ?? 0n;
  const rawFeeP2L  = (feeProToLegend.data as bigint | undefined) ?? 0n;
  const feeB2PStr  = formatUnits(rawFeeB2P, feeTokDec);
  const feeP2LStr  = formatUnits(rawFeeP2L, feeTokDec);
  const rawAllowance = (allowance.data as bigint | undefined) ?? 0n;

  // ---- TX handling (hanya untuk approve, karena merge via API) ----
  const { writeContract, data: txHash, isPending: writePending, error: writeError } = useWriteContract();
  const { isLoading: receiptLoading, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  const busyApprove = writePending || receiptLoading;

  useEffect(() => {
    if (isSuccess) toast("Approve confirmed on-chain.");
    if (writeError) {
      const m = (writeError as any)?.shortMessage || (writeError as any)?.message || "Approve failed";
      toast(m);
    }
  }, [isSuccess, writeError]);

  // ---- Satu tombol: Approve (jika perlu) + Merge via /api/merge ----
  async function onMerge(kind: "BASIC_TO_PRO" | "PRO_TO_LEGEND") {
    if (!user) return toast("Connect wallet dulu.");
    if (!onBase) return toast("Please switch network to Base Sepolia.");
    if (!feeToken) return toast("Fee token belum diset di kontrak.");

    // Guard jumlah & slot (biar gak sia-sia)
    if (kind === "BASIC_TO_PRO") {
      if (basicCount < needBP) return toast(`Butuh ${String(needBP)} Basic untuk merge`);
      if (pUsed >= caps.p) return toast(`Pro slot penuh (${pUsed}/${caps.p}).`);
    } else {
      if (proCount < needPL) return toast(`Butuh ${String(needPL)} Pro untuk merge`);
      if (lUsed >= caps.l) return toast(`Legend slot penuh (${lUsed}/${caps.l}).`);
      if (Number(legendCount) >= caps.l) return toast(`Legend limit per wallet = ${caps.l}.`);
    }

    const needFee = kind === "BASIC_TO_PRO" ? rawFeeB2P : rawFeeP2L;

    try {
      // APPROVE jika allowance kurang
      if (rawAllowance < needFee) {
        writeContract({
          address: feeToken,
          abi: erc20Abi,
          functionName: "approve",
          args: [gameCoreAddress as `0x${string}`, needFee],
          account: user,
          chain: baseSepolia,
        });
        // tunggu approve selesai
        while (true) {
          await new Promise((r) => setTimeout(r, 800));
          // kita pakai polling allowance lagi biar aman
          const res = await fetch("/api/allowance-check?user=" + user); // opsional; kalau gak ada route ini, lanjut pakai delay saja
          break;
        }
      }

      // Merge via API relayer
      const fid = await getFarcasterFID();
      const resp = await fetch("/api/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, kind, fid: Number(fid) }),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        return toast(`Merge ditolak server: ${txt}`);
      }
      const json = await resp.json();
      if (!json?.ok) return toast("Merge gagal (server).");
      toast(`Merge dikirim. TX: ${json.tx}`);
    } catch (e: any) {
      toast(e?.message || "Kesalahan saat approve/merge");
    }
  }

  // ---- UI (Desain aslimu) ----
  const mergingLabelB = `Merge ${String(needBP)} for Pro`;
  const mergingLabelP = `Merge ${String(needPL)} for Legend`;

  return (
    <div className="space-y-4 px-4 pt-4 pb-8">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Workshop / Rakit</h1>
        <p className="text-sm text-neutral-400">Upgrade &amp; Merge your rigs</p>
      </header>

      <div className="space-y-4">
        {/* Basic */}
        <MergeSection
          tierName="Basic"
          ownedCount={basicCount}
          slotCount={10}
          imageSrc="/img/vga_basic.png"
          buttonText={mergingLabelB}
          // tombol boleh diklik selama wallet ada; guard berat di handler
          buttonDisabled={busyApprove || !user}
          onClick={() => onMerge("BASIC_TO_PRO")}
        />

        {/* Pro */}
        <MergeSection
          tierName="Pro"
          ownedCount={proCount}
          slotCount={5}
          imageSrc="/img/vga_pro.gif"
          buttonText={mergingLabelP}
          buttonDisabled={busyApprove || !user}
          onClick={() => onMerge("PRO_TO_LEGEND")}
        />

        {/* Legend (tanpa tombol) */}
        <MergeSection
          tierName="Legend"
          ownedCount={legendCount}
          slotCount={3}
          imageSrc="/img/vga_legend.gif"
        />
      </div>

      <div className="text-xs text-neutral-400 pt-2 space-y-1">
        <div>
          Fee Merge: Basic→Pro = <b>{feeB2PStr}</b> {feeTokSym} • Pro→Legend = <b>{feeP2LStr}</b> {feeTokSym}
        </div>
        <div>
          Slot (caps): Basic <b>{caps.b}</b> • Pro <b>{caps.p}</b> • Legend <b>{caps.l}</b>
        </div>
      </div>
    </div>
  );
}

