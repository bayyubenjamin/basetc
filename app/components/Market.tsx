// app/components/Market.tsx
"use client";

import { useEffect, useMemo, useState, type FC, useCallback } from "react";
import Image from "next/image";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  usePublicClient,
} from "wagmi";
import { base } from "viem/chains";
import {
  rigSaleAddress,
  rigSaleABI,
  rigNftAddress,
  rigNftABI,
} from "../lib/web3Config";
import { formatEther, formatUnits, type Address } from "viem";
import { getFidRefFallback } from "../lib/utils";

/* =============================
   Invite math (original rules) - DIPERTAHANKAN
   ============================= */
function maxClaimsFrom(totalInvites: number): number {
  const n = Math.floor(Number(totalInvites) || 0);
  if (n < 1) return 0;
  return 1 + Math.floor((n - 1) / 2); // 1 pertama, lalu tiap 2 invite
}

function invitesNeededForNext(totalInvites: number, claimed: number): number {
  const nowMax = maxClaimsFrom(totalInvites);
  if (claimed < nowMax) return 0;
  const nextThreshold = 1 + 2 * nowMax; // 1, 3, 5, 7, 9, 11, ...
  return Math.max(0, nextThreshold - totalInvites);
}

/* =============================
   Minimal ERC20 ABI (approval path) - DIPERTAHANKAN
   ============================= */
const erc20ABI = [
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

/* =============================
   UI meta for each tier - DIPERTAHANKAN
   ============================= */
type TierID = "basic" | "pro" | "legend";
interface NFTTier {
  id: TierID;
  name: string;
  image: string;
  hashrateHint: string;
  description: string;
}
const NFT_DATA: NFTTier[] = [
  { id: "basic", name: "Basic Rig", image: "/img/vga_basic.png", hashrateHint: "~1.5 H/s", description: "Claim a free starter rig to begin mining." },
  { id: "pro", name: "Pro Rig", image: "/img/vga_pro.png", hashrateHint: "~8.0 H/s", description: "Upgrade to significantly increase hashrate." },
  { id: "legend", name: "Legend Rig", image: "/img/vga_legend.png", hashrateHint: "~100.0 H/s", description: "Top-tier rig for maximum performance." },
];

/* =============================
   Lightweight Popup & Loading Overlay - DIPERTAHANKAN
   ============================= */
const CenterPopup: FC<{
  open: boolean;
  message: string;
  onOK: () => void;
}> = ({ open, message, onOK }) => {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-[1100] bg-black/60 backdrop-blur-sm" />
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

/* =============================
   Component
   ============================= */
const Market: FC = () => {
  const { address } = useAccount();
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  // --- START PERUBAHAN: qty & max per tier ---
  const MAX_PER_TIER: Record<TierID, number> = { basic: 10, pro: 5, legend: 3 };
  const [qty, setQty] = useState<Record<TierID, number>>({ basic: 1, pro: 1, legend: 1 });
  const clamp = (t: TierID, v: number) => Math.min(MAX_PER_TIER[t], Math.max(1, Math.floor(v || 1)));
  const dec = (t: TierID) => setQty((q) => ({ ...q, [t]: clamp(t, q[t] - 1) }));
  const inc = (t: TierID) => setQty((q) => ({ ...q, [t]: clamp(t, q[t] + 1) }));
  const setManual = (t: TierID, v: string) => setQty((q) => ({ ...q, [t]: clamp(t, Number(v)) }));
  // --- AKHIR PERUBAHAN ---

  // --- START PERUBAHAN ---
  const [inviteStats, setInviteStats] = useState({
    totalInvites: 0,
    claimedRewards: 0,
    loading: true,
  });

  const fetchInviteStats = useCallback(async () => {
    if (!address) {
      setInviteStats({ totalInvites: 0, claimedRewards: 0, loading: false });
      return;
    }
    setInviteStats((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetch(`/api/referral?inviter=${address}`);
      const data = await res.json();
      if (data.ok) {
        setInviteStats({
          totalInvites: data.validInvites ?? 0,
          claimedRewards: data.claimedRewards ?? 0,
          loading: false,
        });
      } else {
        throw new Error(data.error || "Failed to fetch invite stats");
      }
    } catch (err) {
      console.error("fetchInviteStats error:", err);
      setInviteStats({ totalInvites: 0, claimedRewards: 0, loading: false });
    }
  }, [address]);

  useEffect(() => { fetchInviteStats(); }, [fetchInviteStats]);
  // --- AKHIR PERUBAHAN ---

  /* ---------- Rig IDs & Kontrak (DIPERTAHANKAN) ---------- */
  const { data: BASIC } = useReadContract({ address: rigNftAddress, abi: rigNftABI as any, functionName: "BASIC" });
  const { data: PRO } = useReadContract({ address: rigNftAddress, abi: rigNftABI as any, functionName: "PRO" });
  const { data: LEGEND } = useReadContract({ address: rigNftAddress, abi: rigNftABI as any, functionName: "LEGEND" });
  const legendBal = useReadContract({
    address: rigNftAddress,
    abi: rigNftABI as any,
    functionName: "balanceOf",
    args: address && LEGEND !== undefined ? [address, LEGEND] : undefined,
    query: { enabled: Boolean(address && LEGEND !== undefined) },
  });
  const ownedLegend = (legendBal.data as bigint | undefined) ?? 0n;
  const { data: modeVal } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "currentMode" });
  const { data: tokenAddr } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "paymentToken" });
  const mode = Number(modeVal ?? 0);
  const { data: tokenDecimalsRaw } = useReadContract({ address: tokenAddr as Address, abi: erc20ABI as any, functionName: "decimals", query: { enabled: Boolean(tokenAddr && mode === 1) } });
  const { data: tokenSymbolRaw } = useReadContract({ address: tokenAddr as Address, abi: erc20ABI as any, functionName: "symbol", query: { enabled: Boolean(tokenAddr && mode === 1) } });
  const tokenDecimals: number = (tokenDecimalsRaw as number | undefined) ?? 18;
  const tokenSymbol: string = (tokenSymbolRaw as string | undefined) ?? "TOKEN";
  const { data: priceBasic } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "priceOf", args: [BASIC], query: { enabled: Boolean(BASIC) } });
  const { data: pricePro } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "priceOf", args: [PRO], query: { enabled: Boolean(PRO) } });
  const { data: priceLegend } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "priceOf", args: [LEGEND], query: { enabled: Boolean(LEGEND) } });
  const priceOf = (id?: unknown) => (id === BASIC ? priceBasic : id === PRO ? pricePro : id === LEGEND ? priceLegend : undefined);
  const { data: freeOpen } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "freeMintOpen" });
  const { data: freeId } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "freeMintId" });
  
  const [fid, setFid] = useState<bigint | null>(null);
  const [inviter, setInviter] = useState<Address>("0x0000000000000000000000000000000000000000");
  useEffect(() => {
    const f = typeof window !== "undefined" ? window.localStorage.getItem("basetc_fid") : null;
    const r = typeof window !== "undefined" ? window.localStorage.getItem("basetc_ref") : null;
    if (f) setFid(BigInt(f));
    if (r && /^0x[0-9a-fA-F]{40}$/.test(r)) setInviter(r as Address);
  }, []);

  const { data: freeUsed, refetch: refetchFreeUsed } = useReadContract({
    address: rigSaleAddress,
    abi: rigSaleABI as any,
    functionName: "freeMintedByFid",
    args: fid !== null ? [fid] : undefined,
    query: { enabled: Boolean(fid !== null) },
  });
  const isBasicFreeForMe = Boolean(freeOpen && BASIC !== undefined && freeId === BASIC && !freeUsed);
  const { data: allowance = 0n } = useReadContract({
    address: tokenAddr as Address,
    abi: erc20ABI as any,
    functionName: "allowance",
    args: address && tokenAddr ? [address, rigSaleAddress] : undefined,
    query: { enabled: Boolean(address && tokenAddr && mode === 1) },
  });

  /* ============= UX helpers - DIPERTAHANKAN ============= */
  function beginProcessing(label: string) { setMessage(label); setLoading(true); setPopupOpen(false); }
  function finishSuccess(label: string) { setMessage(label); setLoading(false); setPopupOpen(true); }
  function finishError(label: string) { setMessage(label); setLoading(false); setPopupOpen(true); }

  /* =============================
     Actions — DIPERTAHANKAN & DIPERBAIKI
     ============================== */
  const handleClaimBasicFree = async () => {
    beginProcessing("1/3: Requesting server signature…");
    try {
      if (!address) throw new Error("Please connect your wallet.");
      if (!isBasicFreeForMe) throw new Error("You are not eligible for free mint.");
      if (!fid) throw new Error("Farcaster FID not found. Open from Farcaster app.");

      const sigRes = await fetch("/api/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "free-sign", fid: String(fid), to: address, inviter }),
      });
      const sig = await sigRes.json();
      if (!sigRes.ok) throw new Error(sig?.error || "Failed to obtain signature.");

      setMessage("2/3: Sending transaction…");
      const txHash = await writeContractAsync({
        address: rigSaleAddress,
        abi: rigSaleABI as any,
        functionName: "claimFreeByFidSig",
        args: [fid, address, sig.inviter, BigInt(sig.deadline), sig.v, sig.r, sig.s],
        account: address,
        chain: base,
      });

      setMessage("3/3: Waiting for confirmation…");
      await publicClient?.waitForTransactionReceipt({ hash: txHash });

      setMessage("Finalizing: Validating referral…");
      const fid_ref = getFidRefFallback();

      await fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fid: Number(fid),
          validate_referral_now: true,
          fid_ref: fid_ref,
        }),
      });

      finishSuccess("Claim successful! Referral counted.");
      refetchFreeUsed?.();
      fetchInviteStats();
    } catch (e: any) {
      finishError(e?.shortMessage || e?.message || "Transaction failed");
    }
  };

  // --- PERUBAHAN: handleBuy pakai qty + limit per tier ---
  const handleBuy = async (id: bigint, tier: TierID) => {
    try {
      if (!address) return finishError("Please connect your wallet.");
      const unitPrice = priceOf(id) as bigint | undefined;
      if (!unitPrice || unitPrice === 0n) return finishError("Item is not for sale.");

      const q = BigInt(clamp(tier, qty[tier]));

      // per-wallet limit legend
      if (tier === "legend" && ownedLegend + q > 3n) {
        return finishError("Per-wallet limit is 3 Legend rigs.");
      }

      const totalPrice = unitPrice * q;

      if (mode === 0) {
        beginProcessing("Sending transaction (ETH) …");
        const txHash = await writeContractAsync({
          address: rigSaleAddress,
          abi: rigSaleABI as any,
          functionName: "buyWithETH",
          args: [id, q],
          value: totalPrice,
          account: address,
          chain: base,
        });
        setMessage("Waiting for confirmation…");
        await publicClient?.waitForTransactionReceipt({ hash: txHash });
      } else if (mode === 1 && tokenAddr) {
        if ((allowance as bigint) < totalPrice) {
          beginProcessing("Approving spending limit…");
          const approveHash = await writeContractAsync({
            address: tokenAddr as Address,
            abi: erc20ABI,
            functionName: "approve",
            args: [rigSaleAddress, totalPrice],
            account: address,
            chain: base,
          });
          setMessage("Waiting for approval confirmation…");
          await publicClient?.waitForTransactionReceipt({ hash: approveHash });
        }
        beginProcessing("Sending transaction (ERC20) …");
        const buyHash = await writeContractAsync({
          address: rigSaleAddress,
          abi: rigSaleABI as any,
          functionName: "buyWithERC20",
          args: [id, q],
          account: address,
          chain: base,
        });
        setMessage("Waiting for confirmation…");
        await publicClient?.waitForTransactionReceipt({ hash: buyHash });
      } else {
        return finishError("Unsupported payment mode.");
      }

      finishSuccess("Purchase successful! Please go to Monitoring and start mining to sync your RigNFT.");
    } catch (e: any) {
      finishError(e?.shortMessage || e?.message || "Transaction failed");
    }
  };
  // --- AKHIR PERUBAHAN ---

  const tierId = (t: TierID) => (t === "basic" ? (BASIC as bigint) : t === "pro" ? (PRO as bigint) : (LEGEND as bigint));
  const onClickCta = (t: TierID) => {
    const id = tierId(t);
    if (t === "basic" && isBasicFreeForMe) return handleClaimBasicFree;
    return () => handleBuy(id, t);
  };
  const ctaText = (t: TierID) => (t === "basic" && isBasicFreeForMe ? "Claim Free Rig" : "Buy");

  /* =============================
     Invite rewards - DIPERBARUI
     ============================== */
  const { totalInvites, claimedRewards } = inviteStats;
  const maxClaims = useMemo(() => maxClaimsFrom(totalInvites), [totalInvites]);
  const availableClaims = Math.max(0, maxClaims - claimedRewards);
  const needMoreInv = invitesNeededForNext(totalInvites, claimedRewards);

  const [inviteMsg, setInviteMsg] = useState<string>("");
  const [busyInvite, setBusyInvite] = useState(false);

  async function handleClaimInviteReward() {
    try {
      if (!address) throw new Error("Please connect your wallet.");
      if (!fid) throw new Error("Farcaster FID required for reward claim.");

      setInviteMsg("");
      if (availableClaims <= 0) {
        return setInviteMsg(`Need ${needMoreInv} more valid invite(s) for the next claim.`);
      }
      setBusyInvite(true);
      beginProcessing("Relayer is processing your reward claim…");

      const res = await fetch("/api/referral", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "claim", inviter: address, receiver: address, invitee_fid: String(fid) }),
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error || "Claim failed. Check server logs.");

      setInviteMsg(`Reward claimed! Relayer tx: ${json.txHash?.slice?.(0, 8) ?? ""}…`);
      finishSuccess("Invite reward claimed successfully.");
      await fetchInviteStats();
    } catch (e: any) {
      const err = e?.shortMessage || e?.message || "Claim failed.";
      setInviteMsg(err);
      finishError(err);
    } finally {
      setBusyInvite(false);
    }
  }

  /* =============================
     Helper kecil: label diskon per tier (UI only)
     ============================= */
  const discountLabel = (id: TierID) =>
    id === "basic" ? "DISCOUNT 20%" : id === "pro" ? "DISCOUNT 25%" : "DISCOUNT 25%";

  /* =============================
     UI - Neumorphism + kontras teks
   ============================= */
  return (
    <div className="fin-wrap fin-content-pad-bottom px-1.5 pt-1.5 space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-[var(--text)]">Market</h1>
        <p className="text-sm text-[var(--muted)] font-semibold">Mint rigs and invite to earn</p>
      </header>

      {/* Invite Summary Card */}
      <section
        className="fin-card p-4 neu"
        style={{
          marginLeft: "max(10px, env(safe-area-inset-left))",
          marginRight: "max(10px, env(safe-area-inset-right))",
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text)]">Invite Friends</h2>
            <p className="text-xs text-[var(--muted)] font-semibold">Valid invites unlock free Basic rig claims.</p>
          </div>
          <button
            onClick={handleClaimInviteReward}
            disabled={busyInvite || availableClaims <= 0 || !address || inviteStats.loading}
            className={`fin-btn neu-btn text-xs ${busyInvite || availableClaims <= 0 || !address || inviteStats.loading ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {busyInvite ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-transparent animate-spin" />
                Processing…
              </span>
            ) : (
              `Claim${availableClaims > 0 ? ` (${availableClaims})` : ""}`
            )}
          </button>
        </div>
        <div className="mt-2 text-xs text-[var(--muted)] font-semibold">
          {inviteStats.loading ? (
            "Loading invites..."
          ) : (
            <>
              Invites: <b className="text-[var(--text)]">{totalInvites}</b> • Claimed:{" "}
              <b className="text-[var(--text)]">{claimedRewards}</b> • Max now:{" "}
              <b className="text-[var(--text)]">{maxClaims}</b>
            </>
          )}
        </div>
        {availableClaims <= 0 && !inviteStats.loading && (
          <div className="text-xs text-[var(--muted)] font-semibold">
            Need <b className="text-[var(--text)]">{needMoreInv}</b> more valid invite(s) for the next claim.
          </div>
        )}
        {!!inviteMsg && <div className="mt-2 text-xs text-[var(--accent)]">{inviteMsg}</div>}
      </section>

      {/* Product Cards */}
      <section className="space-y-4">
        {NFT_DATA.map((tier) => {
          const id = tier.id === "basic" ? (BASIC as bigint) : tier.id === "pro" ? (PRO as bigint) : (LEGEND as bigint);
          const p = priceOf(id);
          const priceText =
            tier.id === "basic" && isBasicFreeForMe
              ? "FREE"
              : p
              ? mode === 0
                ? `${formatEther(p as bigint)} ETH`
                : `${formatUnits(p as bigint, tokenDecimals)} ${tokenSymbol}`
              : "N/A";
          const disabled = loading || !address || !id;

          return (
            // Card container (relative untuk posisi stiker)
            <div
              key={tier.id}
              className="fin-card p-3 neu relative"
              style={{
                marginLeft: "max(10px, env(safe-area-inset-left))",
                marginRight: "max(10px, env(safe-area-inset-right))",
              }}
            >
              {/* === STIKER DISKON (KANAN ATAS) === */}
              <div className="absolute top-2 right-2 z-10">
                <span
                  className={[
                    "inline-block rounded-md px-2 py-0.5",
                    "text-[10px] font-extrabold tracking-wide",
                    "bg-red-600 text-white border border-red-400/70",
                    "shadow-[0_2px_10px_rgba(0,0,0,0.35)]",
                  ].join(" ")}
                >
                  {discountLabel(tier.id)}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-md neu-inner border border-white/5 flex items-center justify-center overflow-hidden">
                  <Image src={tier.image} alt={tier.name} width={64} height={64} className="object-contain" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-[var(--text)]">{tier.name}</h3>
                  <p className="text-xs text-[var(--muted)] font-semibold">{tier.description}</p>
                  <p className="text-[11px] text-[var(--muted)]">Est. Hashrate: <b className="text-[var(--text)]">{tier.hashrateHint}</b></p>
                </div>
                <div className="text-xs font-bold text-[var(--text)]">{priceText}</div>
              </div>

              {/* Bottom controls */}
              {tier.id === "basic" && isBasicFreeForMe ? (
                <button
                  onClick={onClickCta(tier.id)}
                  disabled={disabled}
                  className={`mt-3 w-full fin-btn neu-btn py-1.5 text-xs ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {ctaText(tier.id)}
                </button>
              ) : (
                <div className="mt-3 flex items-center gap-2">
                  {/* Quantity selector */}
                  <div className="flex items-center neu-inner rounded-md">
                    <button
                      type="button"
                      onClick={() => dec(tier.id)}
                      className="px-3 py-1 text-sm hover:opacity-100 text-white neu-btn"
                      title="Decrease"
                    >
                      −
                    </button>
                    <input
                      value={qty[tier.id]}
                      onChange={(e) => setManual(tier.id, e.target.value)}
                      inputMode="numeric"
                      className="w-12 text-center bg-transparent py-1 text-sm outline-none text-[var(--text)]"
                    />
                    <button
                      type="button"
                      onClick={() => inc(tier.id)}
                      className="px-3 py-1 text-sm hover:opacity-100 text-white neu-btn"
                      title="Increase"
                    >
                      +
                    </button>
                  </div>

                  <button
                    onClick={onClickCta(tier.id)}
                    disabled={disabled}
                    title={!address ? "Connect wallet first" : undefined}
                    className={`ml-auto w-full fin-btn neu-btn py-2 text-xs ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-transparent animate-spin" />
                        Processing…
                      </span>
                    ) : (
                      `Buy`
                    )}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* Legend supply note */}
      <p className="text-center text-[12px] text-yellow-600 font-semibold uppercase tracking-wide mt-2 drop-shadow-[0_0_4px_rgba(255,255,0,0.25)]">
        ⚠️ Legend supply is limited to 3000 only — 1500 for sale + 1500 via merge.
      </p>

      {!!message && <p className="text-center text-xs text-[var(--muted)] whitespace-pre-line font-semibold">{message}</p>}
      <div className="fin-bottom-space" />
      <LoadingOverlay show={loading} label={message || "Processing…"} />
      <CenterPopup
        open={popupOpen}
        message={message}
        onOK={() => setPopupOpen(false)}
      />
    </div>
  );
};

export default Market;