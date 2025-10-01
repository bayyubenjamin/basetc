"use client";

import { useEffect, useMemo, useState } from "react";
import type { FC } from "react";
import Image from "next/image";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  usePublicClient,
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

/* ---------------- ERC20 minimal ---------------- */
const erc20Abi = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "symbol",   stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "allowance",stateMutability: "view", inputs: [{type:"address"},{type:"address"}], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve",  stateMutability: "nonpayable", inputs: [{type:"address"},{type:"uint256"}], outputs: [{ type: "bool" }] },
] as const;

/* ---------------- helpers ---------------- */
const fmt2 = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TierImg: Record<"basic"|"pro"|"legend", string> = {
  basic: "/img/vga_basic.png",
  pro: "/img/vga_pro.gif",
  legend: "/img/vga_legend.gif",
};

const NftSlot: FC<{ filled: boolean; tier: "basic" | "pro" | "legend" }> = ({ filled, tier }) => (
  <div
    className={`w-12 h-12 md:w-16 md:h-16 rounded-md flex items-center justify-center border-2 ${
      filled ? "bg-green-500/20 border-green-500/50" : "bg-neutral-800 border-neutral-700"
    }`}
  >
    {filled ? (
      <Image src={TierImg[tier]} alt={`${tier} rig`} width={48} height={48} className="object-contain" />
    ) : null}
  </div>
);

/* ---------------- component ---------------- */
export default function Rakit() {
  const { address, chainId } = useAccount();
  const user = address as `0x${string}` | undefined;
  const onBase = !chainId || chainId === BASE_CHAIN_ID;
  const publicClient = usePublicClient();

  const [status, setStatus] = useState<string>("");

  /* IDs */
  const basicId  = useReadContract({ address: rigNftAddress as `0x${string}`, abi: rigNftABI as any, functionName: "BASIC" });
  const proId    = useReadContract({ address: rigNftAddress as `0x${string}`, abi: rigNftABI as any, functionName: "PRO" });
  const legendId = useReadContract({ address: rigNftAddress as `0x${string}`, abi: rigNftABI as any, functionName: "LEGEND" });
  const BASIC  = basicId.data  as bigint | undefined;
  const PRO    = proId.data    as bigint | undefined;
  const LEGEND = legendId.data as bigint | undefined;

  /* Owned balances (untuk “Owned: N”) */
  const basicBal  = useReadContract({
    address: rigNftAddress as `0x${string}`,
    abi: rigNftABI as any,
    functionName: "balanceOf",
    args: user && BASIC  !== undefined ? [user, BASIC] : undefined,
    query: { enabled: Boolean(user && BASIC !== undefined) },
  });
  const proBal    = useReadContract({
    address: rigNftAddress as `0x${string}`,
    abi: rigNftABI as any,
    functionName: "balanceOf",
    args: user && PRO    !== undefined ? [user, PRO] : undefined,
    query: { enabled: Boolean(user && PRO !== undefined) },
  });
  const legendBal = useReadContract({
    address: rigNftAddress as `0x${string}`,
    abi: rigNftABI as any,
    functionName: "balanceOf",
    args: user && LEGEND !== undefined ? [user, LEGEND] : undefined,
    query: { enabled: Boolean(user && LEGEND !== undefined) },
  });

  const ownedBasic  = (basicBal.data  as bigint | undefined) ?? 0n;
  const ownedPro    = (proBal.data    as bigint | undefined) ?? 0n;
  const ownedLegend = (legendBal.data as bigint | undefined) ?? 0n;

  /* Usage (dipakai untuk hitung slot terisi) */
  const miningUsage = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "miningUsage",
    args: user ? [user] : undefined,
    query: { enabled: Boolean(user) },
  });
  const [
    _bOwned, bUsed = 0n, _bIdle,
    _pOwned, pUsed = 0n, _pIdle,
    _lOwned, lUsed = 0n, _lIdle,
  ] = ((miningUsage.data as bigint[] | undefined) ?? []).concat([0n,0n,0n,0n,0n,0n,0n,0n,0n]) as bigint[];

  /* Slot caps */
  const rigCaps = useReadContract({ address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: "rigCaps" });
  const caps = useMemo(() => {
    const rc = rigCaps.data as { b: bigint; p: bigint; l: bigint } | undefined;
    return { b: Number(rc?.b ?? 10n), p: Number(rc?.p ?? 5n), l: Number(rc?.l ?? 3n) };
  }, [rigCaps.data]);

  /* Need & fee token */
  const needB2P = useReadContract({ address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: "BASIC_TO_PRO_NEED" });
  const needP2L = useReadContract({ address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: "PRO_TO_LEGEND_NEED" });
  const needBP = (needB2P.data as bigint | undefined) ?? 10n;
  const needPL = (needP2L.data as bigint | undefined) ?? 5n;

  const feeTokenRead = useReadContract({ address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: "mergeFeeToken" });
  const feeToken = (feeTokenRead.data as `0x${string}` | undefined) ?? undefined;

  const feeB2PRead = useReadContract({ address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: "feeBasicToPro" });
  const feeP2LRead = useReadContract({ address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: "feeProToLegend" });
  const feeDecimalsRead = useReadContract({
    address: feeToken,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: Boolean(feeToken) },
  });
  const feeSymbolRead = useReadContract({
    address: feeToken,
    abi: erc20Abi,
    functionName: "symbol",
    query: { enabled: Boolean(feeToken) },
  });
  const allowanceRead = useReadContract({
    address: feeToken,
    abi: erc20Abi,
    functionName: "allowance",
    args: user ? [user, gameCoreAddress as `0x${string}`] : undefined,
    query: { enabled: Boolean(user && feeToken) },
  });

  const feeDecimals = (feeDecimalsRead.data as number | undefined) ?? 18;
  const feeSymbol = (feeSymbolRead.data as string | undefined) ?? "FEE";
  const feeB2P = (feeB2PRead.data as bigint | undefined) ?? 0n;
  const feeP2L = (feeP2LRead.data as bigint | undefined) ?? 0n;
  const feeB2PView = Number(formatUnits(feeB2P, feeDecimals));
  const feeP2LView = Number(formatUnits(feeP2L, feeDecimals));
  const allowance = (allowanceRead.data as bigint | undefined) ?? 0n;

  /* writer */
  const { writeContractAsync } = useWriteContract();

  async function ensureApprove(amount: bigint) {
    if (!user || !feeToken) throw new Error("Fee token not set / wallet not connected.");
    if (allowance >= amount) return;
    setStatus(`Approving ${formatUnits(amount, feeDecimals)} ${feeSymbol}…`);
    const tx = await writeContractAsync({
      address: feeToken,
      abi: erc20Abi,
      functionName: "approve",
      args: [gameCoreAddress as `0x${string}`, amount],
      account: user,
      chain: baseSepolia,
    });
    setStatus(`Waiting approval receipt…`);
    await publicClient!.waitForTransactionReceipt({ hash: tx });
    setStatus(`Approval confirmed.`);
  }

  async function runMerge(kind: "BASIC_TO_PRO" | "PRO_TO_LEGEND") {
    setStatus(`Requesting server merge (${kind})…`);
    const res = await fetch("/api/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user, kind, fid: 0 }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Server merge failed");
    }
    const data = await res.json();
    setStatus(`Merge submitted by server. Tx: ${data.tx ?? "—"}`);
  }

  async function onMergeBasicToPro() {
    if (!user) return setStatus("Connect wallet dulu.");
    setStatus("");
    // tampilkan alasan langsung di panel, tombol tetap klikable
    if (!onBase) return setStatus("Please switch network to Base Sepolia.");
    if (ownedBasic < needBP) return setStatus(`Butuh ${String(needBP)} Basic untuk merge.`);
    if (caps.p <= 0) return setStatus("rigCaps.p = 0 (slot Pro belum di-set).");
    if (Number(pUsed) >= caps.p) return setStatus(`Pro slot penuh (${Number(pUsed)}/${caps.p}).`);

    try {
      await ensureApprove(feeB2P);
      await runMerge("BASIC_TO_PRO");
      // refresh owned/usage biar slot update
      await Promise.all([basicBal.refetch?.(), proBal.refetch?.(), miningUsage.refetch?.()]);
    } catch (e: any) {
      setStatus(e?.shortMessage || e?.message || "Merge failed");
    }
  }

  async function onMergeProToLegend() {
    if (!user) return setStatus("Connect wallet dulu.");
    setStatus("");
    if (!onBase) return setStatus("Please switch network to Base Sepolia.");
    if (ownedPro < needPL) return setStatus(`Butuh ${String(needPL)} Pro untuk merge.`);
    if (caps.l <= 0) return setStatus("rigCaps.l = 0 (slot Legend belum di-set).");
    if (Number(lUsed) >= caps.l) return setStatus(`Legend slot penuh (${Number(lUsed)}/${caps.l}).`);

    try {
      await ensureApprove(feeP2L);
      await runMerge("PRO_TO_LEGEND");
      await Promise.all([proBal.refetch?.(), legendBal.refetch?.(), miningUsage.refetch?.()]);
    } catch (e: any) {
      setStatus(e?.shortMessage || e?.message || "Merge failed");
    }
  }

  /* ---------------- UI (desain grid slot seperti awal) ---------------- */
  return (
    <div className="space-y-4 px-4 pt-4 pb-8">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Build Rig</h1>
        <p className="text-sm text-neutral-400">Upgrade &amp; Merge your rigs</p>
      </header>

      {/* Basic */}
      <section className="bg-neutral-800 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Basic Rigs</h2>
            <p className="text-sm text-neutral-400">Owned: {String(ownedBasic)}</p>
          </div>
          <Image src={TierImg.basic} alt="Basic rig" width={64} height={64} />
        </div>
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: Math.max(1, caps.b) }).map((_, i) => (
            <NftSlot key={`b-${i}`} filled={i < Math.min(Number(ownedBasic), caps.b)} tier="basic" />
          ))}
        </div>
        <button
          onClick={(e) => { e.preventDefault(); onMergeBasicToPro(); }}
          className={`w-full px-3 py-2 text-sm rounded-md transition-colors ${
            user ? "bg-blue-600 hover:bg-blue-500 text-white" : "bg-neutral-700 text-neutral-400 cursor-not-allowed"
          }`}
          disabled={!user} // cuma disabled saat belum connect
        >
          {`Merge ${String(needBP)} for Pro`}
          <span className="ml-2 text-xs text-neutral-300">
            (fee {fmt2(Number(formatUnits(feeB2P, feeDecimals)))} {feeSymbol})
          </span>
        </button>
      </section>

      {/* Pro */}
      <section className="bg-neutral-800 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Pro Rigs</h2>
            <p className="text-sm text-neutral-400">Owned: {String(ownedPro)}</p>
          </div>
          <Image src={TierImg.pro} alt="Pro rig" width={64} height={64} />
        </div>
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: Math.max(1, caps.p) }).map((_, i) => (
            <NftSlot key={`p-${i}`} filled={i < Math.min(Number(ownedPro), caps.p)} tier="pro" />
          ))}
        </div>
        <button
          onClick={(e) => { e.preventDefault(); onMergeProToLegend(); }}
          className={`w-full px-3 py-2 text-sm rounded-md transition-colors ${
            user ? "bg-purple-600 hover:bg-purple-500 text-white" : "bg-neutral-700 text-neutral-400 cursor-not-allowed"
          }`}
          disabled={!user}
        >
          {`Merge ${String(needPL)} for Legend`}
          <span className="ml-2 text-xs text-neutral-300">
            (fee {fmt2(Number(formatUnits(feeP2L, feeDecimals)))} {feeSymbol})
          </span>
        </button>
      </section>

      {/* Legend */}
      <section className="bg-neutral-800 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Legend Rigs</h2>
            <p className="text-sm text-neutral-400">Owned: {String(ownedLegend)}</p>
          </div>
          <Image src={TierImg.legend} alt="Legend rig" width={64} height={64} />
        </div>
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: Math.max(1, caps.l) }).map((_, i) => (
            <NftSlot key={`l-${i}`} filled={i < Math.min(Number(ownedLegend), caps.l)} tier="legend" />
          ))}
        </div>
        <p className="text-xs text-neutral-400">
          Per-wallet Legend limit mengikuti <code>rigCaps.l</code> (default 3). Jika sudah penuh,
          merge ke Legend akan dinonaktifkan oleh guard server.
        </p>
      </section>

      {/* Status panel (selalu kelihatan step-nya) */}
      <div className="text-xs text-neutral-300 min-h-5">{status}</div>
    </div>
  );
}

