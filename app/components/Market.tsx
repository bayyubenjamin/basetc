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
  gameCoreAddress, // <-- Impor alamat GameCore
  gameCoreABI,    // <-- Impor ABI GameCore
} from "../lib/web3Config";
import { formatEther, formatUnits, type Address } from "viem";
import { getFidRefFallback } from "../lib/utils";

/* =============================
   Invite math (original rules) - DIPERTAHANKAN
   ============================= */
function maxClaimsFrom(totalInvites: number): number {
  if (totalInvites <= 0) return 0;
  if (totalInvites <= 10) return 1 + Math.floor(Math.max(0, totalInvites - 1) / 2);
  return 5 + Math.floor((totalInvites - 10) / 3);
}
function invitesNeededForNext(totalInvites: number, claimed: number): number {
  const nowMax = maxClaimsFrom(totalInvites);
  if (claimed < nowMax) return 0;
  let t = totalInvites;
  while (maxClaimsFrom(t) < claimed + 1) t++;
  return t - totalInvites;
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
  { id: "pro", name: "Pro Rig", image: "/img/vga_pro.png", hashrateHint: "~5.0 H/s", description: "Upgrade to significantly increase hashrate." },
  { id: "legend", name: "Legend Rig", image: "/img/vga_legend.png", hashrateHint: "~25.0 H/s", description: "Top-tier rig for maximum performance." },
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

  useEffect(() => {
    fetchInviteStats();
  }, [fetchInviteStats]);

  /* ---------- Kontrak Reads (DIPERTAHANKAN) ---------- */
  const { data: BASIC } = useReadContract({ address: rigNftAddress, abi: rigNftABI as any, functionName: "BASIC" });
  const { data: PRO } = useReadContract({ address: rigNftAddress, abi: rigNftABI as any, functionName: "PRO" });
  const { data: LEGEND } = useReadContract({ address: rigNftAddress, abi: rigNftABI as any, functionName: "LEGEND" });
  
  // --- START PERUBAHAN ---
  // Baca status isPrelaunch dari GameCore
  const { data: isPrelaunch } = useReadContract({
    address: gameCoreAddress,
    abi: gameCoreABI as any,
    functionName: "isPrelaunch"
  });
  // --- AKHIR PERUBAHAN ---

  const legendBal = useReadContract({ address: rigNftAddress, abi: rigNftABI as any, functionName: "balanceOf", args: address && LEGEND !== undefined ? [address, LEGEND] : undefined, query: { enabled: Boolean(address && LEGEND !== undefined) }});
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

  function beginProcessing(label: string) { setMessage(label); setLoading(true); setPopupOpen(false); }
  function finishSuccess(label: string) { setMessage(label); setLoading(false); setPopupOpen(true); }
  function finishError(label: string) { setMessage(label); setLoading(false); setPopupOpen(true); }

  /* =============================
     Actions — DIPERBARUI
     ============================== */
  const handleClaimBasicFree = async () => {
    // --- START PERUBAHAN ---
    // Cek status prelaunch terlebih dahulu
    if (isPrelaunch) {
      finishError("Your free rig will be available to claim once the first epoch begins.");
      return;
    }
    // --- AKHIR PERUBAHAN ---

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

  const handleBuy = async (id: bigint) => {
    try {
      if (!address) return finishError("Please connect your wallet.");
      const price = priceOf(id) as bigint | undefined;
      if (!price || price === 0n) return finishError("Item is not for sale.");

      if (id === (LEGEND as bigint | undefined) && ownedLegend >= 3n) {
        return finishError("Per-wallet limit is 3 Legend rigs.");
      }

      if (mode === 0) {
        beginProcessing("Sending transaction (ETH) …");
        const txHash = await writeContractAsync({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "buyWithETH", args: [id, 1n], value: price, account: address, chain: base });
        setMessage("Waiting for confirmation…");
        await publicClient?.waitForTransactionReceipt({ hash: txHash });
      } else if (mode === 1 && tokenAddr) {
        if ((allowance as bigint) < price) {
          beginProcessing("Approving spending limit…");
          const approveHash = await writeContractAsync({ address: tokenAddr as Address, abi: erc20ABI, functionName: "approve", args: [rigSaleAddress, price], account: address, chain: base });
          setMessage("Waiting for approval confirmation…");
          await publicClient?.waitForTransactionReceipt({ hash: approveHash });
        }
        beginProcessing("Sending transaction (ERC20) …");
        const buyHash = await writeContractAsync({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "buyWithERC20", args: [id, 1n], account: address, chain: base });
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

  const tierId = (t: TierID) => (t === "basic" ? (BASIC as bigint) : t === "pro" ? (PRO as bigint) : (LEGEND as bigint));
  const onClickCta = (t: TierID) => {
    const id = tierId(t);
    if (t === "basic" && isBasicFreeForMe) return handleClaimBasicFree;
    return () => handleBuy(id);
  };
  const ctaText = (t: TierID) => (t === "basic" && isBasicFreeForMe ? "Claim Free Rig" : "Buy");

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
     UI
   ============================== */
  return (
    <div className="fin-wrap fin-content-pad-bottom px-4 pt-4 space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Market</h1>
        <p className="text-sm text-neutral-400">Mint rigs and invite to earn</p>
      </header>

      <section className="fin-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Invite Friends</h2>
            <p className="text-xs text-neutral-400">Valid invites unlock free Basic rig claims.</p>
          </div>
          <button
            onClick={handleClaimInviteReward}
            disabled={busyInvite || availableClaims <= 0 || !address || inviteStats.loading}
            className={`fin-btn fin-btn-claim text-xs ${busyInvite || availableClaims <= 0 || !address || inviteStats.loading ? "opacity-50 cursor-not-allowed" : ""}`}
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
        <div className="mt-2 text-xs text-neutral-400">
          {inviteStats.loading ? (
            "Loading invites..."
          ) : (
            <>
              Invites: <b>{totalInvites}</b> • Claimed: <b>{claimedRewards}</b> • Max now: <b>{maxClaims}</b>
            </>
          )}
        </div>
        {availableClaims <= 0 && !inviteStats.loading && (
          <div className="text-xs text-neutral-400">
            Need <b>{needMoreInv}</b> more valid invite(s) for the next claim.
          </div>
        )}
        {!!inviteMsg && <div className="mt-2 text-xs text-blue-400">{inviteMsg}</div>}
      </section>
      
      <section className="space-y-4">
        {NFT_DATA.map((tier) => {
          const id = tierId(tier.id);
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
            <div key={tier.id} className="fin-card p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-md bg-neutral-800 border border-white/5 flex items-center justify-center overflow-hidden">
                  <Image src={tier.image} alt={tier.name} width={64} height={64} className="object-contain" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">{tier.name}</h3>
                  <p className="text-xs text-neutral-400">{tier.description}</p>
                  <p className="text-[11px] text-neutral-500">Est. Hashrate: {tier.hashrateHint}</p>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs text-neutral-400 mb-1">{priceText}</span>
                <button
                  onClick={onClickCta(tier.id)}
                  disabled={disabled}
                  title={!address ? "Connect wallet first" : undefined}
                  className={`fin-btn fin-btn-claim px-3 py-1.5 text-xs transition-transform active:scale-[0.98] ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-transparent animate-spin" />
                      Processing…
                    </span>
                  ) : (
                    ctaText(tier.id)
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </section>

      {!!message && <p className="text-center text-xs text-neutral-400 whitespace-pre-line">{message}</p>}
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
