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

/* Small slot preview component (keeps fin-* theme) */
const NftSlot: FC<{ filled: boolean; tier: "basic" | "pro" | "legend" }> = ({ filled, tier }) => (
  <div
    className={`rounded-md grid place-items-center border
      ${filled ? "bg-green-500/12 border-green-500/40" : "bg-[#151a2e] border-[#1e263f]"}
      w-12 h-12 md:w-16 md:h-16`}
  >
    {filled ? (
      <Image
        src={TierImg[tier]}
        alt={`${tier} rig`}
        width={48}
        height={48}
        className="object-contain"
      />
    ) : (
      <div className="text-[10px] text-neutral-400">empty</div>
    )}
  </div>
);

/* ---------------- Popup (shown only on success/fail) + Processing overlay ---------------- */
const CenterPopup: FC<{ open: boolean; message: string; onOK: () => void }> = ({ open, message, onOK }) => {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-[1100] bg-black/60 backdrop-blur-sm" />
      <div className="fixed inset-0 z-[1200] grid place-items-center p-4">
        <div className="w-full max-w-sm rounded-2xl bg-neutral-900 text-white shadow-2xl border border-white/10">
          <div className="p-5">
            <div className="text-center text-sm leading-relaxed whitespace-pre-line">
              {message || "Done."}
            </div>
            <div className="mt-5 flex justify-center">
              <button
                onClick={onOK}
                className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-500 active:scale-[0.99]"
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
        <div className="flex items-center gap-3 rounded-xl bg-neutral-900 text-white border border-white/10 px-4 py-3 shadow-xl">
          <div className="h-5 w-5 rounded-full border-2 border-white/30 border-t-transparent animate-spin" />
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

  const [status, setStatus] = useState<string>("");       // step status (also shown in popup on finish)
  const [loading, setLoading] = useState<boolean>(false);  // processing overlay
  const [popupOpen, setPopupOpen] = useState<boolean>(false); // OK popup (only on success/fail)

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

  /* Usage for slot usage display */
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

  // === helpers for consistent UX ===
  function beginProcessing(label: string) {
    setStatus(label);
    setLoading(true);      // show overlay
    setPopupOpen(false);   // make sure popup hidden during processing
  }
  function finishSuccess(label: string) {
    setStatus(label);
    setLoading(false);     // hide overlay
    setPopupOpen(true);    // show OK popup
  }
  function finishError(label: string) {
    setStatus(label);
    setLoading(false);
    setPopupOpen(true);
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
      chain: baseSepolia,
    });
    setStatus(`Waiting for approval confirmation…`);
    await publicClient!.waitForTransactionReceipt({ hash: tx });
    setStatus(`Approval confirmed.`);
    // keep overlay on; next steps will continue
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
    if (!user) { finishError("Please connect your wallet."); return; }
    if (!onBase) { finishError("Please switch network to Base Sepolia."); return; }
    if (ownedBasic < needBP) { finishError(`You need ${String(needBP)} Basic to merge.`); return; }
    if (caps.p <= 0) { finishError("rigCaps.p = 0 (Pro slots not configured)."); return; }
    if (Number(pUsed) >= caps.p) { finishError(`Pro slots are full (${Number(pUsed)}/${caps.p}).`); return; }

    try {
      beginProcessing("Starting merge to Pro…");
      await ensureApprove(feeB2P);
      await runMerge("BASIC_TO_PRO");

      setStatus("Refreshing balances…");
      await Promise.all([basicBal.refetch?.(), proBal.refetch?.(), miningUsage.refetch?.()]);

      finishSuccess("Merge to Pro successful!. Please go to Monitoring and start mining to sync your RigNFT.");
    } catch (e: any) {
      finishError(e?.shortMessage || e?.message || "Merge failed");
    }
  }

  async function onMergeProToLegend() {
    if (!user) { finishError("Please connect your wallet."); return; }
    if (!onBase) { finishError("Please switch network to Base Sepolia."); return; }
    if (ownedPro < needPL) { finishError(`You need ${String(needPL)} Pro to merge.`); return; }
    if (caps.l <= 0) { finishError("rigCaps.l = 0 (Legend slots not configured)."); return; }
    if (Number(lUsed) >= caps.l) { finishError(`Legend slots are full (${Number(lUsed)}/${caps.l}).`); return; }

    try {
      beginProcessing("Starting merge to Legend…");
      await ensureApprove(feeP2L);
      await runMerge("PRO_TO_LEGEND");

      setStatus("Refreshing balances…");
      await Promise.all([proBal.refetch?.(), legendBal.refetch?.(), miningUsage.refetch?.()]);

      finishSuccess("Merge to Legend successful!. Please go to Monitoring and start mining to sync your RigNFT.");
    } catch (e: any) {
      finishError(e?.shortMessage || e?.message || "Merge failed");
    }
  }

  /* ---------------- UI (fintech-aligned) ---------------- */
  return (
    <div className="fin-wrap fin-content-pad-bottom">
      {/* Page head */}
      <div className="fin-page-head">
        <h1>Build Rig</h1>
        <p>Upgrade &amp; merge your rigs</p>
      </div>

      {/* BASIC */}
      <section className="fin-card fin-card-pad" aria-label="Basic rigs">
        <div className="fin-row">
          <div className="fin-epoch">
            <small>Basic</small>
            <strong>Owned: {String(ownedBasic)}</strong>
          </div>
          <div className="flex items-center gap-2">
            <Image src={TierImg.basic} alt="Basic rig" width={44} height={44} />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-5 gap-2">
          {Array.from({ length: Math.max(1, caps.b) }).map((_, i) => (
            <NftSlot
              key={`b-${i}`}
              filled={i < Math.min(Number(ownedBasic), caps.b)}
              tier="basic"
            />
          ))}
        </div>

        <div className="fin-actions">
          <div className="fin-cooldown">
            Need: <b>{String(needBP)}</b> Basic → Pro
            <span className="opacity-70 ml-2">
              (fee {fmt2(Number(formatUnits(feeB2P, feeDecimals)))} {feeSymbol})
            </span>
          </div>
          <button
            onClick={(e) => { e.preventDefault(); onMergeBasicToPro(); }}
            className="fin-btn fin-btn-claim transition-transform active:scale-[0.98]"
            disabled={!user || loading}
            title={!user ? "Connect wallet" : "Merge to Pro"}
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-transparent animate-spin" />
                Processing…
              </span>
            ) : (
              "Merge to Pro"
            )}
          </button>
        </div>
      </section>

      {/* PRO */}
      <section className="fin-card fin-card-pad" aria-label="Pro rigs">
        <div className="fin-row">
          <div className="fin-epoch">
            <small>Pro</small>
            <strong>Owned: {String(ownedPro)}</strong>
          </div>
          <div className="flex items-center gap-2">
            <Image src={TierImg.pro} alt="Pro rig" width={44} height={44} />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-5 gap-2">
          {Array.from({ length: Math.max(1, caps.p) }).map((_, i) => (
            <NftSlot
              key={`p-${i}`}
              filled={i < Math.min(Number(ownedPro), caps.p)}
              tier="pro"
            />
          ))}
        </div>

        <div className="fin-actions">
          <div className="fin-cooldown">
            Need: <b>{String(needPL)}</b> Pro → Legend
            <span className="opacity-70 ml-2">
              (fee {fmt2(Number(formatUnits(feeP2L, feeDecimals)))} {feeSymbol})
            </span>
          </div>
          <button
            onClick={(e) => { e.preventDefault(); onMergeProToLegend(); }}
            className="fin-btn fin-btn-claim transition-transform active:scale-[0.98]"
            disabled={!user || loading}
            title={!user ? "Connect wallet" : "Merge to Legend"}
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-transparent animate-spin" />
                Processing…
              </span>
            ) : (
              "Merge to Legend"
            )}
          </button>
        </div>
      </section>

      {/* LEGEND (display only) */}
      <section className="fin-card fin-card-pad" aria-label="Legend rigs">
        <div className="fin-row">
          <div className="fin-epoch">
            <small>Legend</small>
            <strong>Owned: {String(ownedLegend)}</strong>
          </div>
          <div className="flex items-center gap-2">
            <Image src={TierImg.legend} alt="Legend rig" width={44} height={44} />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-5 gap-2">
          {Array.from({ length: Math.max(1, caps.l) }).map((_, i) => (
            <NftSlot
              key={`l-${i}`}
              filled={i < Math.min(Number(ownedLegend), caps.l)}
              tier="legend"
            />
          ))}
        </div>
      </section>

      {/* legacy inline status (still kept for compatibility) */}
      <div className="fin-msg min-h-5 whitespace-pre-line">{status}</div>
      <div className="fin-bottom-space" />

      {/* overlays */}
      <LoadingOverlay show={loading} label={status || "Processing…"} />
      <CenterPopup open={popupOpen} message={status} onOK={() => setPopupOpen(false)} />
    </div>
  );
}
