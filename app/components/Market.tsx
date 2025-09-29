"use client";

import { useEffect, useMemo, useState } from "react";
import type { FC } from "react";
import Image from "next/image";
import {
  useAccount,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { baseSepolia } from "wagmi/chains";
import {
  rigSaleAddress,
  rigSaleABI,
  rigNftAddress,
  rigNftABI,
} from "../lib/web3Config";
import { formatEther, formatUnits, type Address } from "viem";

// =============================
// Invite Math (1 • 2× s/d 10 • 3× setelahnya)
// =============================
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

// ERC20 minimal ABI
const erc20ABI = [
  { type: "function", name: "symbol",   stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ], outputs: [{ type: "uint256" }]
  },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [
      { name: "spender", type: "address" },
      { name: "amount",  type: "uint256" },
    ], outputs: [{ type: "bool" }]
  },
] as const;

type TierID = "basic" | "pro" | "legend";
interface NFTTier {
  id: TierID;
  name: string;
  image: string;
  hashrateHint: string;
  description: string;
}
const NFT_DATA: NFTTier[] = [
  { id: "basic",  name: "Basic Rig",  image: "/img/vga_basic.png",  hashrateHint: "~1.5 H/s",  description: "Claim your first rig for free to start mining." },
  { id: "pro",    name: "Pro Rig",    image: "/img/vga_pro.gif",    hashrateHint: "~5.0 H/s",  description: "Upgrade for a significant boost in hashrate." },
  { id: "legend", name: "Legend Rig", image: "/img/vga_legend.gif", hashrateHint: "~25.0 H/s", description: "The ultimate rig for professional miners." },
];

export interface MarketProps { onTransactionSuccess?: () => void; }

const Market: FC<MarketProps> = ({ onTransactionSuccess }) => {
  const { address } = useAccount();
  const [message, setMessage] = useState<string>("");

  // ----- Ambil ID tier dari RigNFT -----
  const basicId = useReadContract({ address: rigNftAddress, abi: rigNftABI as any, functionName: "BASIC" });
  const proId   = useReadContract({ address: rigNftAddress, abi: rigNftABI as any, functionName: "PRO" });
  const legId   = useReadContract({ address: rigNftAddress, abi: rigNftABI as any, functionName: "LEGEND" });

  const BASIC  = basicId.data as bigint | undefined;
  const PRO    = proId.data   as bigint | undefined;
  const LEGEND = legId.data   as bigint | undefined;

  // ----- Mode & Token Pembayaran -----
  const modeRes = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "currentMode" }); // 0=ETH, 1=ERC20
  const payTokenRes = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "paymentToken" });
  const modeVal = modeRes.data as number | undefined;
  const tokenAddr = (payTokenRes.data as `0x${string}` | undefined) || undefined;

  // Jika ERC20, ambil symbol & decimals
  const decRes = useReadContract({
    address: tokenAddr, abi: erc20ABI as any, functionName: "decimals",
    query: { enabled: Boolean(tokenAddr && modeVal === 1) },
  });
  const symRes = useReadContract({
    address: tokenAddr, abi: erc20ABI as any, functionName: "symbol",
    query: { enabled: Boolean(tokenAddr && modeVal === 1) },
  });
  const tokenDecimals = (decRes.data as number | undefined) ?? 18;
  const tokenSymbol   = (symRes.data as string | undefined) ?? "TOKEN";

  // ----- Harga aktif per ID -----
  const priceBasicRes = useReadContract({
    address: rigSaleAddress, abi: rigSaleABI as any, functionName: "priceOf",
    args: BASIC !== undefined ? [BASIC] : undefined,
    query: { enabled: Boolean(BASIC !== undefined) },
  });
  const priceProRes = useReadContract({
    address: rigSaleAddress, abi: rigSaleABI as any, functionName: "priceOf",
    args: PRO !== undefined ? [PRO] : undefined,
    query: { enabled: Boolean(PRO !== undefined) },
  });
  const priceLegendRes = useReadContract({
    address: rigSaleAddress, abi: rigSaleABI as any, functionName: "priceOf",
    args: LEGEND !== undefined ? [LEGEND] : undefined,
    query: { enabled: Boolean(LEGEND !== undefined) },
  });
  const priceOf = (id: bigint | undefined) => {
    if (id === BASIC)  return priceBasicRes.data as bigint | undefined;
    if (id === PRO)    return priceProRes.data as bigint | undefined;
    if (id === LEGEND) return priceLegendRes.data as bigint | undefined;
    return undefined;
  };

  // ----- Free mint status -----
  const freeOpenRes = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "freeMintOpen" });
  const freeIdRes   = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "freeMintId" });
  // NOTE: kontrak versi FID biasanya track "freeMintedByFid", tapi di UI kita tetap pakai flag address untuk UX dasar
  const freeMineRes = useReadContract({
    address: rigSaleAddress, abi: rigSaleABI as any, functionName: "freeMinted",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });
  const freeOpen  = Boolean(freeOpenRes.data);
  const freeId    = freeIdRes.data as bigint | undefined;
  const freeUsed  = Boolean(freeMineRes.data);
  const isBasicFreeForMe = freeOpen && BASIC !== undefined && freeId === BASIC && !freeUsed;

  // ===== [NEW] Ambil FID & inviter dari URL/localStorage =====
  const [fid, setFid] = useState<bigint>(0n);
  const [inviter, setInviter] = useState<Address>("0x0000000000000000000000000000000000000000");
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const qFid = url.searchParams.get("fid");
      const qRef = url.searchParams.get("ref");
      const lsFid = typeof window !== "undefined" ? window.localStorage.getItem("basetc_fid") : null;
      const lsRef = typeof window !== "undefined" ? window.localStorage.getItem("basetc_ref") : null;

      const fidNum = qFid ?? lsFid ?? "";
      if (fidNum && /^\d+$/.test(fidNum)) setFid(BigInt(fidNum));

      const refAddr = (qRef ?? lsRef ?? "").trim();
      if (refAddr && /^0x[0-9a-fA-F]{40}$/.test(refAddr)) setInviter(refAddr as Address);
    } catch {}
  }, []);

  // ----- ERC20 allowance -----
  const allowanceRes = useReadContract({
    address: tokenAddr, abi: erc20ABI as any, functionName: "allowance",
    args: address && tokenAddr ? [address, rigSaleAddress] : undefined,
    query: { enabled: Boolean(address && tokenAddr && modeVal === 1) },
  });
  const allowance = (allowanceRes.data as bigint | undefined) ?? 0n;

  // ----- Writer -----
  const { writeContractAsync } = useWriteContract();

  // Helper format harga
  const fmtPrice = (p?: bigint) => {
    if (!p) return "Coming Soon";
    if (modeVal === 0) return `${Number(formatEther(p)).toLocaleString()} ETH`;
    if (modeVal === 1) return `${Number(formatUnits(p, tokenDecimals)).toLocaleString()} ${tokenSymbol}`;
    return "Loading…";
  };
  const priceLabel = (id: bigint | undefined, tier: TierID) => {
    if (!id) return "Loading…";
    if (tier === "basic" && isBasicFreeForMe) return "FREE";
    return fmtPrice(priceOf(id));
  };

  // ---- Handlers ----
  // [CHANGED] Sekarang pakai claimFreeByFidSig dengan signature dari backend
  const handleClaimBasicFree = async () => {
    try {
      setMessage("");
      if (!address) return setMessage("Connect wallet first.");
      if (!freeOpen) return setMessage("Free mint belum dibuka.");
      if (!fid || fid === 0n) return setMessage("FID Farcaster tidak ditemukan. Tambah ?fid=... di URL atau set localStorage 'basetc_fid'.");

      // Minta payload signature ke server
      const res = await fetch("/api/referral", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "free-sign",
          fid: String(fid),
          to: address,
          inviter, // bisa 0x0 kalau tanpa referral
        }),
      });
      const sig = await res.json();
      if (sig?.error) throw new Error(sig.error);
      if (!("v" in sig) || !("r" in sig) || !("s" in sig) || !("deadline" in sig)) {
        return setMessage("Signer belum aktif di backend (v,r,s kosong).");
      }

      // Panggil kontrak: claimFreeByFidSig(fid, to, inviter, deadline, v, r, s)
      await writeContractAsync({
        address: rigSaleAddress,
        abi: rigSaleABI as any,
        functionName: "claimFreeByFidSig",
        args: [
          BigInt(sig.fid ?? fid),
          address as `0x${string}`,
          (sig.inviter ?? inviter) as `0x${string}`,
          BigInt(sig.deadline),
          sig.v, sig.r, sig.s,
        ],
        account: address as `0x${string}`,
        chain: baseSepolia,
      });

      setMessage("Free mint sukses!");
      onTransactionSuccess?.();
    } catch (e: any) {
      setMessage(e?.shortMessage || e?.message || "Claim failed");
    }
  };

  const handleBuy = async (id: bigint | undefined) => {
    try {
      setMessage("");
      if (!address) return setMessage("Connect wallet first.");
      if (!id) return setMessage("Tier ID not ready.");
      const price = priceOf(id);
      if (!price || price === 0n) return setMessage("Not for sale.");

      if (modeVal === 0) {
        // ETH
        await writeContractAsync({
          address: rigSaleAddress,
          abi: rigSaleABI as any,
          functionName: "buyWithETH",
          args: [id, 1n] as const,
          value: price,
          account: address as `0x${string}`,
          chain: baseSepolia,
        });
        setMessage("Purchase success (ETH)!");
        onTransactionSuccess?.();
        return;
      }

      if (modeVal === 1 && tokenAddr) {
        if (allowance < price) {
          // approve dulu
          await writeContractAsync({
            address: tokenAddr,
            abi: erc20ABI as any,
            functionName: "approve",
            args: [rigSaleAddress, price] as const,
            account: address as `0x${string}`,
            chain: baseSepolia,
          });
        }
        await writeContractAsync({
          address: rigSaleAddress,
          abi: rigSaleABI as any,
          functionName: "buyWithERC20",
          args: [id, 1n] as const,
          account: address as `0x${string}`,
          chain: baseSepolia,
        });
        setMessage(`Purchase success!`);
        onTransactionSuccess?.();
        return;
      }

      setMessage("Unsupported mode.");
    } catch (e: any) {
      setMessage(e?.shortMessage || e?.message || "Transaction failed");
    }
  };

  const tierId = (t: TierID) => (t === "basic" ? BASIC : t === "pro" ? PRO : LEGEND);
  const onClickCta = (t: TierID) => {
    const id = tierId(t);
    if (t === "basic" && isBasicFreeForMe) return () => handleClaimBasicFree(); // <- sekarang sig-based
    return () => handleBuy(id);
  };
  const ctaText = (t: TierID) => (t === "basic" && isBasicFreeForMe ? "Claim Free Rig" : "Buy");

  // ==========================================================
  // Invite Task + Free Mint CARDs (tetap, hanya tombol claim free diubah)
  // ==========================================================

  const inviteCountRes = useReadContract({
    address: rigSaleAddress,
    abi: rigSaleABI as any,
    functionName: "inviteCountOf",
    args: address ? [address as Address] : undefined,
    query: { enabled: Boolean(address) },
  });
  const totalInvites = inviteCountRes?.data ? Number(inviteCountRes.data as bigint) : 0;

  const [claimedRewards, setClaimedRewards] = useState(0);
  useEffect(() => {
    if (!address) return;
    fetch(`/api/referral?inviter=${address}`)
      .then(r => r.json())
      .then(d => setClaimedRewards(d?.claimedRewards ?? 0))
      .catch(() => {});
  }, [address]);

  const maxClaims = useMemo(() => maxClaimsFrom(totalInvites), [totalInvites]);
  const availableClaims = Math.max(0, maxClaims - claimedRewards);
  const needMoreInv = invitesNeededForNext(totalInvites, claimedRewards);

  const [inviteMsg, setInviteMsg] = useState<string>("");
  const [busyInvite, setBusyInvite] = useState(false);

  async function handleClaimInviteReward() {
    try {
      if (!address) return setInviteMsg("Connect wallet dulu.");
      setInviteMsg("");
      if (availableClaims <= 0) {
        return setInviteMsg(`Butuh ${needMoreInv} invite lagi untuk klaim berikutnya.`);
      }
      setBusyInvite(true);

      // TODO (opsional): mint on-chain via relayer di backend terlebih dulu
      const res = await fetch("/api/referral", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inviter: address, inc: 1 }),
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error || "Claim gagal");

      setClaimedRewards(json?.claimedRewards ?? (claimedRewards + 1));
      setInviteMsg("Reward dicatat. (Mint on-chain via relayer/patch kontrak: next step)");
    } catch (e: any) {
      setInviteMsg(e?.shortMessage || e?.message || "Claim gagal");
    } finally {
      setBusyInvite(false);
    }
  }

  return (
    <div className="space-y-4 px-4 pt-4 pb-8">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Market</h1>
        <p className="text-sm text-neutral-400">Mint &amp; Listings</p>
      </header>

      <div className="text-[11px] text-neutral-400">
        Mode: {modeVal === 0 ? "ETH" : modeVal === 1 ? `Token (${tokenSymbol})` : "—"}
      </div>

      {/* Free Mint Card (tombol sekarang claimFreeByFidSig) */}
      <div className="rounded-2xl p-4 border border-white/10 bg-white/5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm opacity-80">Free Mint</div>
            <div className="text-lg font-semibold">User Baru → 1 Basic {freeId !== undefined ? `(ID #${String(freeId)})` : ""}</div>
            {!freeOpen && <div className="text-xs opacity-70">Free mint belum dibuka.</div>}
          </div>
          <div className="flex gap-2">
            <button
              disabled={!freeOpen || !isBasicFreeForMe}
              onClick={handleClaimBasicFree}
              className={`px-3 py-2 rounded-lg ${freeOpen && isBasicFreeForMe ? "bg-cyan-500" : "bg-neutral-600 cursor-not-allowed"}`}
              title={!freeOpen ? "Closed" : (!isBasicFreeForMe ? "Tidak tersedia / sudah di-claim" : undefined)}
            >
              Claim Free
            </button>
          </div>
        </div>
        {!!message && <div className="mt-2 text-sm opacity-90">{message}</div>}
      </div>

      {/* Invite Task Card */}
      <div className="rounded-2xl p-4 border border-white/10 bg-white/5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm opacity-80">Invite Friends → Free Basic</div>
            <div className="text-lg font-semibold">1 • 2× sampai 10 • 3× setelahnya</div>
          </div>
          <button
            onClick={handleClaimInviteReward}
            disabled={busyInvite || availableClaims <= 0}
            className={`px-4 py-2 rounded-xl ${availableClaims>0 ? "bg-green-500" : "bg-neutral-600 cursor-not-allowed"}`}
          >
            {busyInvite ? "Claiming..." : `CLAIM ${availableClaims>0 ? `(${availableClaims})` : ""}`}
          </button>
        </div>

        <div className="mt-2 text-sm">
          Total undangan valid: <b>{totalInvites}</b> • Sudah diklaim: <b>{claimedRewards}</b> • Maks seharusnya: <b>{maxClaims}</b>
        </div>
        {availableClaims<=0 && (
          <div className="text-xs opacity-80">Butuh <b>{needMoreInv}</b> invite lagi untuk buka klaim berikutnya.</div>
        )}
        {!!inviteMsg && <div className="mt-2 text-sm opacity-90">{inviteMsg}</div>}
      </div>

      <div className="space-y-4">
        {NFT_DATA.map((tier) => {
          const id = tierId(tier.id);
          const priceText = priceLabel(id, tier.id);
          return (
            <div key={tier.id} className="flex items-center bg-neutral-800 rounded-lg p-3 space-x-3">
              <div className="w-16 h-16 bg-neutral-700 rounded-md flex items-center justify-center relative overflow-hidden">
                <Image
                  src={tier.image}
                  alt={tier.name}
                  width={64}
                  height={64}
                  className="object-contain"
                />
              </div>
              <div className="flex-1">
                <div className="flex items-baseline justify-between">
                  <h3 className="font-semibold text-sm md:text-base">{tier.name}</h3>
                  <span className="text-xs md:text-sm text-neutral-400">{priceText}</span>
                </div>
                <p className="text-xs text-neutral-400 pt-0.5">{tier.description}</p>
                <p className="text-xs text-neutral-400 pt-0.5">Est. Hashrate: {tier.hashrateHint}</p>
              </div>
              <div>
                <button
                  onClick={onClickCta(tier.id)}
                  disabled={!address || !id}
                  className="px-3 py-1.5 text-xs rounded-md bg-neutral-700 hover:bg-neutral-600 text-white disabled:bg-neutral-700 disabled:text-neutral-500"
                  title={!address ? "Connect wallet first" : undefined}
                >
                  {ctaText(tier.id)}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pesan global */}
      {/* {!!message && <p className="text-xs text-green-400">{message}</p>} */}
    </div>
  );
};

export default Market;

