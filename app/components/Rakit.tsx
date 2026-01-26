// app/components/Rakit.tsx
"use client";

import { useEffect, useMemo, useState, type FC } from "react";
import Image from "next/image";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  usePublicClient,
} from "wagmi";
import { base } from "viem/chains";
import { formatUnits } from "viem";
import confetti from "canvas-confetti"; 
import sdk from "@farcaster/miniapp-sdk"; // Pastikan install ini
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

const triggerHaptic = (type: "light" | "success" | "error") => {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    try {
      if (type === "light") navigator.vibrate(50);
      if (type === "success") navigator.vibrate([50, 50, 50]);
      if (type === "error") navigator.vibrate([50, 100, 50]);
    } catch { }
  }
};

const TierImg: Record<"basic"|"pro"|"legend", string> = {
  basic: "/img/vga_basic.png",
  pro: "/img/vga_pro.png",
  legend: "/img/vga_legend.png",
};

/* Warna bingkai per tier */
const slotBorderByTier: Record<"basic"|"pro"|"legend", string> = {
  basic: "border-white/60",
  pro: "border-[#67a8ff]/80",
  legend: "border-[#f5d06f]/85",
};

/* === SLOT === */
const NftSlot: FC<{ filled: boolean; tier: "basic" | "pro" | "legend" }> = ({ filled, tier }) => (
  <div
    className={[
      "relative grid place-items-center w-12 h-12 md:w-16 md:h-16",
      "rounded-[8px]",
      "border", slotBorderByTier[tier],
      "p-[1px]",
      "bg-transparent transition-all duration-300 hover:scale-105",
    ].join(" ")}
  >
    <div className="w-full h-full rounded-[7px] overflow-hidden neu-inner bg-[#f3f7ff] grid place-items-center">
      {filled ? (
        <Image
          src={TierImg[tier]}
          alt={`${tier} rig`}
          width={64}
          height={64}
          className="w-full h-full object-cover rounded-[7px]"
        />
      ) : (
        <div className="text-[10px] text-[var(--muted)] font-semibold opacity-50">EMPTY</div>
      )}
    </div>
  </div>
);

/* ---------------- Popup + Share Action ---------------- */
const CenterPopup: FC<{ open: boolean; message: string; type?: "success" | "error"; onShare?: () => void; onOK: () => void }> = ({ open, message, type, onShare, onOK }) => {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-[1100] bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" />
      <div className="fixed inset-0 z-[1200] grid place-items-center p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white text-[var(--text)] shadow-2xl border border-[color:rgba(0,0,0,.06)] scale-100 animate-in zoom-in-95 duration-200">
          <div className="p-6 flex flex-col items-center text-center">
            {type === "success" && (
                <div className="mb-4 h-12 w-12 rounded-full bg-green-100 text-green-600 grid place-items-center text-2xl">🎉</div>
            )}
            <h3 className="text-lg font-bold mb-2">{type === "success" ? "Success!" : "Notice"}</h3>
            <div className="text-sm leading-relaxed whitespace-pre-line text-gray-600 mb-6">
              {message || "Done."}
            </div>
            
            <div className="flex gap-3 w-full">
              <button
                onClick={onOK}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 active:scale-[0.98]"
              >
                Close
              </button>
              
              {type === "success" && onShare && (
                 <button
                 onClick={onShare}
                 className="flex-1 px-4 py-2.5 rounded-xl bg-[#855DCD] text-white font-bold text-sm hover:opacity-90 active:scale-[0.98] shadow-lg shadow-purple-200"
               >
                 Share on Cast 🚀
               </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const LoadingOverlay: FC<{ show: boolean; label?: string }> = ({ show, label }) => {
  if (!show) return null;
  return (
    <>
      <div className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-[1px]" />
      <div className="fixed inset-0 z-[1010] grid place-items-center">
        <div className="flex flex-col items-center gap-4 rounded-2xl bg-white p-6 shadow-2xl min-w-[200px]">
          <div className="h-10 w-10 rounded-full border-4 border-[var(--accent)] border-t-transparent animate-spin" />
          <span className="text-sm font-semibold text-gray-700 animate-pulse">{label ?? "Processing…"}</span>
        </div>
      </div>
    </>
  );
};

/* ---------------- component ---------------- */
export default function Rakit() {
  const { address, chainId } = useAccount();
  const user = address as `0x${string}` | undefined;
  const onBase = !chainId || chainId === BASE_CHAIN_ID;
  const publicClient = usePublicClient();

  const [status, setStatus] = useState<string>("");
  const [lastTxType, setLastTxType] = useState<"success" | "error" | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const [popupOpen, setPopupOpen] = useState<boolean>(false);
  const [upgradedTier, setUpgradedTier] = useState<"PRO" | "LEGEND" | null>(null);

  /* IDs */
  const basicId  = useReadContract({ address: rigNftAddress as `0x${string}`, abi: rigNftABI as any, functionName: "BASIC" });
  const proId    = useReadContract({ address: rigNftAddress as `0x${string}`, abi: rigNftABI as any, functionName: "PRO" });
  const legendId = useReadContract({ address: rigNftAddress as `0x${string}`, abi: rigNftABI as any, functionName: "LEGEND" });
  const BASIC  = basicId.data  as bigint | undefined;
  const PRO    = proId.data    as bigint | undefined;
  const LEGEND = legendId.data as bigint | undefined;

  /* Owned balances */
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

  /* Usage */
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
  ] = ((miningUsage.data as bigint[] | undefined) ?? [])
      .concat([0n,0n,0n,0n,0n,0n,0n,0n,0n]) as bigint[];

  /* Slot caps */
  const rigCaps = useReadContract({ address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: "rigCaps" });
  const caps = useMemo(() => {
    const rc = rigCaps.data as { b: bigint; p: bigint; l: bigint } | undefined;
    return { b: Number(rc?.b ?? 10n), p: Number(rc?.p ?? 10n), l: Number(rc?.l ?? 3n) };
  }, [rigCaps.data]);

  /* Need & fee */
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

  const allowance = (allowanceRead.data as bigint | undefined) ?? 0n;
  const { writeContractAsync } = useWriteContract();

  function beginProcessing(label: string) {
    setStatus(label);
    setLoading(true);
    setPopupOpen(false);
    setLastTxType(undefined);
  }

  function finishSuccess(label: string, tier: "PRO" | "LEGEND") {
    setStatus(label);
    setLoading(false);
    setLastTxType("success");
    setUpgradedTier(tier);
    setPopupOpen(true);
    triggerConfetti();
    triggerHaptic("success");
  }

  function finishError(label: string) {
    setStatus(label);
    setLoading(false);
    setLastTxType("error");
    setPopupOpen(true);
    triggerHaptic("error");
  }

  // --- VIRAL FEATURE: Share to Warpcast ---
  function shareSuccess() {
    const text = `I just upgraded my mining rig to ${upgradedTier} Tier on @basetc! 🛠️\n\nBuilding the future on Base. Join the factory now! 🏭\n\n#BaseTC #BuildOnBase`;
    // Gunakan URL frame kamu jika ada, atau URL app
    const embed = "https://basetc.vercel.app"; 
    const url = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(embed)}`;
    
    // Coba buka via SDK jika di dalam frame, fallback ke window open
    try {
        sdk.actions.openUrl(url);
    } catch {
        window.open(url, "_blank");
    }
  }

  function prettyErr(e: any): string {
    const msg = String(e?.shortMessage || e?.message || e || "");
    if (/ERC20:\s*transfer amount exceeds balance/i.test(msg)) return "Your Balance is too low for fees.";
    if (/insufficient funds/i.test(msg)) return "Insufficient ETH for gas.";
    if (/user rejected|denied transaction/i.test(msg)) return "Transaction cancelled.";
    return msg || "Something went wrong.";
  }

  function triggerConfetti() {
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };
    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) return clearInterval(interval);
      const particleCount = 50 * (timeLeft / duration);
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
      confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
    }, 250);
  }

  async function ensureApprove(amount: bigint) {
    if (!user || !feeToken) throw new Error("Fee token not set / wallet not connected.");
    if (allowance >= amount) return;

    beginProcessing(`Approving ${formatUnits(amount, feeDecimals)} ${feeSymbol}…`);
    const tx = await writeContractAsync({
      address: feeToken,
      abi: erc20Abi,
      functionName: "approve",
      args: [gameCoreAddress as `0x${string}`, amount],
      account: user,
      chain: base,
    });

    setStatus(`Waiting for approval confirmation…`);
    await publicClient!.waitForTransactionReceipt({ hash: tx });
    setStatus(`Approval confirmed.`);
  }

  async function runMerge(kind: "BASIC_TO_PRO" | "PRO_TO_LEGEND") {
    setStatus(`Forging new hardware (${kind})…`);
    // Simulasi delay sedikit biar kerasa "berat" prosesnya (psikologi UX)
    await new Promise(r => setTimeout(r, 800)); 

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
    setStatus(`Success! Tx: ${data.tx ?? "—"}`);
  }

  async function onMergeBasicToPro() {
    triggerHaptic("light");
    if (!user) return finishError("Please connect your wallet.");
    if (!onBase) return finishError("Switch network to Base.");
    if (ownedBasic < needBP) return finishError(`Need ${String(needBP)} Basic rigs.`);
    if (Number(pUsed) >= caps.p) return finishError(`Pro slots full.`);

    try {
      beginProcessing("Initializing Merge Protocol...");
      await ensureApprove(feeB2P);
      await runMerge("BASIC_TO_PRO");
      setStatus("Syncing inventory...");

      await Promise.all([basicBal.refetch?.(), proBal.refetch?.(), miningUsage.refetch?.()]);
      finishSuccess("Upgrade Complete: PRO RIG acquired!", "PRO");
    } catch (e: any) {
      finishError(prettyErr(e));
    }
  }

  async function onMergeProToLegend() {
    triggerHaptic("light");
    if (!user) return finishError("Please connect wallet.");
    if (!onBase) return finishError("Switch network to Base.");
    if (ownedPro < needPL) return finishError(`Need ${String(needPL)} Pro rigs.`);
    if (Number(lUsed) >= caps.l) return finishError(`Legend slots full.`);

    try {
      beginProcessing("Initializing Merge Protocol...");
      await ensureApprove(feeP2L);
      await runMerge("PRO_TO_LEGEND");
      setStatus("Syncing inventory...");

      await Promise.all([proBal.refetch?.(), legendBal.refetch?.(), miningUsage.refetch?.()]);
      finishSuccess("Upgrade Complete: LEGEND RIG acquired!", "LEGEND");
    } catch (e: any) {
      finishError(prettyErr(e));
    }
  }

  /* ---------------- UI ---------------- */
  return (
    <div className="fin-wrap fin-content-pad-bottom pb-20">
      <div className="fin-page-head mb-6">
        <h1 className="text-3xl font-black tracking-tighter text-[var(--text)]">FACTORY</h1>
        <p className="text-[var(--muted)] font-medium">Combine rigs to increase hashrate.</p>
      </div>

      {/* BASIC SECTION */}
      <section className="fin-card p-5 mb-6 neu relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
            <span className="text-6xl font-black">B</span>
        </div>
        <div className="flex justify-between items-end mb-4 relative z-10">
            <div>
                <h2 className="text-xl font-bold text-[var(--text)]">BASIC RIGS</h2>
                <div className="flex gap-2 text-xs text-[var(--muted)] font-mono mt-1">
                    <span className="bg-gray-100 px-2 py-0.5 rounded">OWNED: {String(ownedBasic)}</span>
                    <span className="bg-gray-100 px-2 py-0.5 rounded">ACTIVE: {String(bUsed)}/{caps.b}</span>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-5 md:grid-cols-8 gap-2 mb-4">
          {Array.from({ length: Math.max(1, caps.b) }).map((_, i) => (
            <NftSlot key={`b-${i}`} filled={i < Math.min(Number(ownedBasic), caps.b)} tier="basic" />
          ))}
        </div>

        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
          <div className="flex justify-between items-center text-sm mb-2">
            <span className="text-gray-500">Requirement</span>
            <span className="font-bold">{String(needBP)} Basic Rigs</span>
          </div>
          <button
            onClick={(e) => { e.preventDefault(); onMergeBasicToPro(); }}
            className={`w-full py-3 rounded-lg font-bold text-white shadow-md transition-all active:scale-[0.98]
                ${(!user || loading) ? "bg-gray-300 cursor-not-allowed" : "bg-gradient-to-r from-blue-500 to-blue-600 hover:shadow-blue-200"}`}
            disabled={!user || loading}
          >
            MERGE TO PRO
          </button>
          <div className="text-[10px] text-center text-gray-400 mt-2">
            Fee: {fmt2(Number(formatUnits(feeB2P, feeDecimals)))} {feeSymbol}
          </div>
        </div>
      </section>

      {/* PRO SECTION */}
      <section className="fin-card p-5 mb-6 neu relative overflow-hidden group">
         <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
            <span className="text-6xl font-black text-blue-500">P</span>
        </div>
        <div className="flex justify-between items-end mb-4 relative z-10">
            <div>
                <h2 className="text-xl font-bold text-[var(--text)]">PRO RIGS</h2>
                 <div className="flex gap-2 text-xs text-[var(--muted)] font-mono mt-1">
                    <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded">OWNED: {String(ownedPro)}</span>
                    <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded">ACTIVE: {String(pUsed)}/{caps.p}</span>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-5 md:grid-cols-8 gap-2 mb-4">
          {Array.from({ length: Math.max(1, caps.p) }).map((_, i) => (
            <NftSlot key={`p-${i}`} filled={i < Math.min(Number(ownedPro), caps.p)} tier="pro" />
          ))}
        </div>

        <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-100">
          <div className="flex justify-between items-center text-sm mb-2">
            <span className="text-gray-500">Requirement</span>
            <span className="font-bold text-blue-800">{String(needPL)} Pro Rigs</span>
          </div>
          <button
            onClick={(e) => { e.preventDefault(); onMergeProToLegend(); }}
            className={`w-full py-3 rounded-lg font-bold text-white shadow-md transition-all active:scale-[0.98]
                ${(!user || loading) ? "bg-gray-300 cursor-not-allowed" : "bg-gradient-to-r from-purple-500 to-purple-600 hover:shadow-purple-200"}`}
            disabled={!user || loading}
          >
            MERGE TO LEGEND
          </button>
           <div className="text-[10px] text-center text-gray-400 mt-2">
            Fee: {fmt2(Number(formatUnits(feeP2L, feeDecimals)))} {feeSymbol}
          </div>
        </div>
      </section>

      {/* LEGEND SECTION */}
      <section className="fin-card p-5 neu relative overflow-hidden">
        <div className="absolute top-0 right-0 p-2 opacity-10">
            <span className="text-6xl font-black text-yellow-500">L</span>
        </div>
        <div className="flex justify-between items-end mb-4">
            <div>
                <h2 className="text-xl font-bold text-[var(--text)]">LEGEND RIGS</h2>
                 <div className="flex gap-2 text-xs text-[var(--muted)] font-mono mt-1">
                    <span className="bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded">OWNED: {String(ownedLegend)}</span>
                    <span className="bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded">ACTIVE: {String(lUsed)}/{caps.l}</span>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-5 md:grid-cols-8 gap-2">
          {Array.from({ length: Math.max(1, caps.l) }).map((_, i) => (
            <NftSlot key={`l-${i}`} filled={i < Math.min(Number(ownedLegend), caps.l)} tier="legend" />
          ))}
        </div>
      </section>

      <div className="fin-bottom-space" />

      <LoadingOverlay show={loading} label={status} />
      
      {/* Updated Popup with Share Logic */}
      <CenterPopup 
        open={popupOpen} 
        message={status} 
        type={lastTxType}
        onShare={lastTxType === "success" ? shareSuccess : undefined}
        onOK={() => setPopupOpen(false)} 
      />
    </div>
  );
}
