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
import { formatUnits, parseUnits } from "viem";
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
  pro: "/img/vga_pro.png",
  legend: "/img/vga_legend.png",
};

/* Warna bingkai per tier */
const slotBorderByTier: Record<"basic"|"pro"|"legend", string> = {
  basic: "border-white/60",
  pro: "border-[#67a8ff]/80",
  legend: "border-[#f5d06f]/85",
};

/* === SLOT === (tampilan terang) */
const NftSlot: FC<{ filled: boolean; tier: "basic" | "pro" | "legend" }> = ({ filled, tier }) => (
  <div
    className={[
      "relative grid place-items-center w-12 h-12 md:w-16 md:h-16",
      "rounded-[8px]",
      "border", slotBorderByTier[tier],
      "p-[1px]",
      "bg-transparent",
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
        <div className="text-[10px] text-[var(--muted)] font-semibold">empty</div>
      )}
    </div>
  </div>
);

/* ---------------- Popup + Processing overlay ---------------- */
const CenterPopup: FC<{ open: boolean; message: string; onOK: () => void }> = ({ open, message, onOK }) => {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-[1100] bg-black/50 backdrop-blur-sm" />
      <div className="fixed inset-0 z-[1200] grid place-items-center p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white/90 text-[var(--text)] shadow-2xl border border-[color:rgba(0,0,0,.06)] backdrop-blur-md">
          <div className="p-5">
            <div className="text-center text-sm leading-relaxed whitespace-pre-line">
              {message || "Done."}
            </div>
            <div className="mt-5 flex justify-center">
              <button
                onClick={onOK}
                className="px-4 py-2 rounded-md bg-[var(--accent)] text-white text-sm hover:opacity-90 active:scale-[0.99]"
              >
                OK
              </button>
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
        <div className="flex items-center gap-3 rounded-xl bg-white/90 text-[var(--text)] border border-[color:rgba(0,0,0,.06)] px-4 py-3 shadow-xl backdrop-blur-md">
          <div className="h-5 w-5 rounded-full border-2 border-[rgba(0,0,0,.2)] border-t-transparent animate-spin" />
          <span className="text-sm whitespace-pre-line">{label ?? "Processing…"}</span>
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
  const [loading, setLoading] = useState<boolean>(false);
  const [popupOpen, setPopupOpen] = useState<boolean>(false);

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
    return { b: Number(rc?.b ?? 10n), p: Number(rc?.p ?? 5n), l: Number(rc?.l ?? 3n) };
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
  }
  function finishSuccess(label: string) {
    setStatus(label);
    setLoading(false);
    setPopupOpen(true);
  }
  function finishError(label: string) {
    setStatus(label);
    setLoading(false);
    setPopupOpen(true);
  }

  function prettyErr(e: any): string {
    const msg = String(e?.shortMessage || e?.message || e || "");
    if (/ERC20:\s*transfer amount exceeds balance/i.test(msg)) return "Your USDC balance is not enough.";
    if (/insufficient funds/i.test(msg)) return "Insufficient ETH for gas.";
    if (/user rejected|denied transaction|rejected the request/i.test(msg)) return "Transaction rejected.";
    return msg || "Something went wrong.";
  }

  async function ensureApprove(amount: bigint) {
    if (!user || !feeToken) throw new Error("Fee token not set / wallet not connected.");
    const maxAllowance = parseUnits("100", feeDecimals);
    if (allowance >= amount) return;

    beginProcessing(`Approving ${formatUnits(maxAllowance, feeDecimals)} ${feeSymbol}…`);
    const tx = await writeContractAsync({
      address: feeToken,
      abi: erc20Abi,
      functionName: "approve",
      args: [gameCoreAddress as `0x${string}`, maxAllowance],
      account: user,
      chain: base,
    });

    setStatus(`Waiting for approval confirmation…`);
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
    if (!user) return finishError("Please connect your wallet.");
    if (!onBase) return finishError("Please switch network to Base Sepolia.");
    if (ownedBasic < needBP) return finishError(`You need ${String(needBP)} Basic to merge.`);
    if (caps.p <= 0) return finishError("rigCaps.p = 0 (Pro slots not configured).");
    if (Number(pUsed) >= caps.p) return finishError(`Pro slots are full (${Number(pUsed)}/${caps.p}).`);

    try {
      beginProcessing("Starting merge to Pro…");
      await ensureApprove(feeB2P);
      await runMerge("BASIC_TO_PRO");
      setStatus("Refreshing balances…");

      await Promise.all([basicBal.refetch?.(), proBal.refetch?.(), miningUsage.refetch?.()]);
      finishSuccess("Merge to Pro successful!. Please go to Monitoring and start mining to sync your RigNFT.");
    } catch (e: any) {
      finishError(prettyErr(e));
    }
  }

  async function onMergeProToLegend() {
    if (!user) return finishError("Please connect your wallet.");
    if (!onBase) return finishError("Please switch network to Base Sepolia.");
    if (ownedPro < needPL) return finishError(`You need ${String(needPL)} Pro to merge.`);
    if (caps.l <= 0) return finishError("rigCaps.l = 0 (Legend slots not configured).");
    if (Number(lUsed) >= caps.l) return finishError(`Legend slots are full (${Number(lUsed)}/${caps.l}).`);

    try {
      beginProcessing("Starting merge to Legend…");
      await ensureApprove(feeP2L);
      await runMerge("PRO_TO_LEGEND");
      setStatus("Refreshing balances…");

      await Promise.all([proBal.refetch?.(), legendBal.refetch?.(), miningUsage.refetch?.()]);
      finishSuccess("Merge to Legend successful!. Please go to Monitoring and start mining to sync your RigNFT.");
    } catch (e: any) {
      finishError(prettyErr(e));
    }
  }

  /* ---------------- UI ---------------- */
  return (
    <div className="fin-wrap fin-content-pad-bottom">
      <div className="fin-page-head">
        <h1 className="text-[var(--text)]">Build Rig</h1>
        <p className="text-[var(--muted)] font-semibold">Upgrade &amp; merge your rigs</p>
      </div>

      {/* BASIC */}
      <section className="fin-card fin-card-pad neu" aria-label="Basic rigs">
        <div className="fin-row">
          <div className="fin-epoch">
            <strong className="text-[var(--text)] uppercase font-extrabold tracking-wide">BASIC</strong>
            <small className="text-xs text-[var(--muted)] font-semibold">
              Owned: <span className="text-[var(--text)]">{String(ownedBasic)}</span>
              <span className="mx-1">•</span>
              Used: <span className="text-[var(--text)]">{String(bUsed)}</span>
            </small>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-5 auto-rows-max gap-2">
          {Array.from({ length: Math.max(1, caps.b) }).map((_, i) => (
            <NftSlot key={`b-${i}`} filled={i < Math.min(Number(ownedBasic), caps.b)} tier="basic" />
          ))}
        </div>

        <div className="mt-4 border-t border-[rgba(0,0,0,.08)] pt-3">
          <div className="text-sm text-[var(--muted)] font-semibold">
            Need: <b className="text-[var(--text)]">{String(needBP)}</b> Basic → Pro
            <span className="ml-2">
              (fee <b className="text-[var(--text)]">{fmt2(Number(formatUnits(feeB2P, feeDecimals)))}</b> {feeSymbol})
            </span>
          </div>

          <button
            onClick={(e) => { e.preventDefault(); onMergeBasicToPro(); }}
            className={`mt-3 w-full fin-btn neu-btn !py-2 text-sm transition-transform active:scale-[0.98] ${(!user || loading) ? "opacity-50 cursor-not-allowed" : ""}`}
            disabled={!user || loading}
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-transparent animate-spin" />
                Processing…
              </span>
            ) : ("Merge to Pro")}
          </button>
        </div>
      </section>

      {/* PRO */}
      <section className="fin-card fin-card-pad neu" aria-label="Pro rigs">
        <div className="fin-row">
          <div className="fin-epoch">
            <strong className="text-[var(--text)] uppercase font-extrabold tracking-wide">PRO</strong>
            <small className="text-xs text-[var(--muted)] font-semibold">
              Owned: <span className="text-[var(--text)]">{String(ownedPro)}</span>
              <span className="mx-1">•</span>
              Used: <span className="text-[var(--text)]">{String(pUsed)}</span>
            </small>
          </div>
        </div>

        {/* 🔥 FIX HERE ONLY — TAMBAH flex-wrap biar slot bisa lebih dari 5 */}
        <div className="mt-3 grid grid-cols-5 gap-2 flex-wrap content-start">
          {Array.from({ length: Math.max(1, caps.p) }).map((_, i) => (
            <NftSlot key={`p-${i}`} filled={i < Math.min(Number(ownedPro), caps.p)} tier="pro" />
          ))}
        </div>

        <div className="mt-4 border-t border-[rgba(0,0,0,.08)] pt-3">
          <div className="text-sm text-[var(--muted)] font-semibold">
            Need: <b className="text-[var(--text)]">{String(needPL)}</b> Pro → Legend
            <span className="ml-2">
              (fee <b className="text-[var(--text)]">{fmt2(Number(formatUnits(feeP2L, feeDecimals)))}</b> {feeSymbol})
            </span>
          </div>

          <button
            onClick={(e) => { e.preventDefault(); onMergeProToLegend(); }}
            className={`mt-3 w-full fin-btn neu-btn !py-2 text-sm transition-transform active:scale-[0.98] ${(!user || loading) ? "opacity-50 cursor-not-allowed" : ""}`}
            disabled={!user || loading}
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-transparent animate-spin" />
                Processing…
              </span>
            ) : ("Merge to Legend")}
          </button>
        </div>
      </section>

      {/* LEGEND */}
      <section className="fin-card fin-card-pad neu" aria-label="Legend rigs">
        <div className="fin-row">
          <div className="fin-epoch">
            <strong className="text-[var(--text)] uppercase font-extrabold tracking-wide">LEGEND</strong>
            <small className="text-xs text-[var(--muted)] font-semibold">
              Owned: <span className="text-[var(--text)]">{String(ownedLegend)}</span>
              <span className="mx-1">•</span>
              Used: <span className="text-[var(--text)]">{String(lUsed)}</span>
            </small>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-5 gap-2">
          {Array.from({ length: Math.max(1, caps.l) }).map((_, i) => (
            <NftSlot key={`l-${i}`} filled={i < Math.min(Number(ownedLegend), caps.l)} tier="legend" />
          ))}
        </div>
      </section>

      <div className="fin-msg min-h-5 whitespace-pre-line text-[var(--muted)] font-semibold">{status}</div>
      <div className="fin-bottom-space" />

      <LoadingOverlay show={loading} label={status || "Processing…"} />
      <CenterPopup open={popupOpen} message={status} onOK={() => setPopupOpen(false)} />
    </div>
  );
}