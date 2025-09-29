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
import { baseSepolia } from "wagmi/chains";
import {
  rigSaleAddress,
  rigSaleABI,
  rigNftAddress,
  rigNftABI,
} from "../lib/web3Config";
import { formatEther, formatUnits, type Address } from "viem";

/* =============================
    Invite Math (Fungsi Asli Dikembalikan)
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

// ERC20 minimal ABI (Fungsi Asli)
const erc20ABI = [
  { type: "function", name: "symbol",    stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals",  stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
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
  const publicClient = usePublicClient();
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // ----- Ambil ID tier dari RigNFT -----
  const { data: BASIC } = useReadContract({ address: rigNftAddress, abi: rigNftABI as any, functionName: "BASIC" });
  const { data: PRO } = useReadContract({ address: rigNftAddress, abi: rigNftABI as any, functionName: "PRO" });
  const { data: LEGEND } = useReadContract({ address: rigNftAddress, abi: rigNftABI as any, functionName: "LEGEND" });

  // ----- Mode & Token Pembayaran -----
  const { data: modeVal } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "currentMode" }); // 0=ETH, 1=ERC20
  const { data: tokenAddr } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "paymentToken" });
  
  // Jika ERC20, ambil symbol & decimals
  const { data: tokenDecimals = 18 } = useReadContract({ address: tokenAddr as Address, abi: erc20ABI as any, functionName: "decimals", query: { enabled: !!(tokenAddr && modeVal === 1) } });
  const { data: tokenSymbol = "TOKEN" } = useReadContract({ address: tokenAddr as Address, abi: erc20ABI as any, functionName: "symbol", query: { enabled: !!(tokenAddr && modeVal === 1) } });

  // ----- Harga aktif per ID -----
  const { data: priceBasic } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "priceOf", args: [BASIC], query: { enabled: !!BASIC } });
  const { data: pricePro } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "priceOf", args: [PRO], query: { enabled: !!PRO } });
  const { data: priceLegend } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "priceOf", args: [LEGEND], query: { enabled: !!LEGEND } });
  
  const priceOf = (id: unknown) => {
    if (id === BASIC)  return priceBasic;
    if (id === PRO)    return pricePro;
    if (id === LEGEND) return priceLegend;
    return undefined;
  };

  // ----- Free mint status -----
  const { data: freeOpen } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "freeMintOpen" });
  const { data: freeId } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "freeMintId" });
  const { data: freeUsed, refetch: refetchFreeUsed } = useReadContract({
    address: rigSaleAddress, abi: rigSaleABI as any, functionName: "freeMintedByFid",
    args: [BigInt(localStorage.getItem("basetc_fid") || "0")],
    query: { enabled: !!localStorage.getItem("basetc_fid") },
  });

  const isBasicFreeForMe = freeOpen && BASIC !== undefined && freeId === BASIC && !freeUsed;

  // ===== Ambil FID & inviter dari localStorage (simple)
  const [fid, setFid] = useState<bigint | null>(null);
  const [inviter, setInviter] = useState<Address>("0x0000000000000000000000000000000000000000");

  useEffect(() => {
    const storedFid = localStorage.getItem("basetc_fid");
    if (storedFid) setFid(BigInt(storedFid));
    const storedRef = localStorage.getItem("basetc_ref");
    if (storedRef && /^0x[0-9a-fA-F]{40}$/.test(storedRef)) setInviter(storedRef as Address);
  }, []);

  // ----- ERC20 allowance -----
  const { data: allowance = 0n } = useReadContract({
    address: tokenAddr as Address, abi: erc20ABI as any, functionName: "allowance",
    args: address && tokenAddr ? [address, rigSaleAddress] : undefined,
    query: { enabled: !!(address && tokenAddr && modeVal === 1) },
  });

  // ----- Writer -----
  const { writeContractAsync } = useWriteContract();

  /* ============================
      Handlers
  ============================ */
  const handleClaimBasicFree = async () => {
    setLoading(true);
    setMessage("");
    try {
      if (!address) throw new Error("Please connect wallet first.");
      if (!isBasicFreeForMe) throw new Error("Not eligible for free mint.");
      if (!fid) throw new Error("Farcaster FID not found. Open from Farcaster app.");

      setMessage("Requesting signature...");
      const sigRes = await fetch("/api/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "free-sign", fid: String(fid), to: address, inviter }),
      });
      const sigData = await sigRes.json();
      if (!sigRes.ok) throw new Error(sigData.error || "Failed to get signature.");

      setMessage("Awaiting transaction confirmation...");
      const txHash = await writeContractAsync({
        address: rigSaleAddress,
        abi: rigSaleABI as any,
        functionName: "claimFreeByFidSig",
        args: [fid, address, sigData.inviter, BigInt(sigData.deadline), sigData.v, sigData.r, sigData.s],
      });
      await publicClient?.waitForTransactionReceipt({ hash: txHash });

      setMessage("Updating referral status...");
      if (inviter !== "0x0000000000000000000000000000000000000000") {
        await fetch("/api/referral", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "mark-valid", invitee_fid: String(fid), invitee_wallet: address }),
        });
      }

      setMessage("Claim successful!");
      refetchFreeUsed();
      onTransactionSuccess?.();
    } catch (e: any) {
      setMessage(e?.shortMessage || e?.message || "Transaction failed");
    } finally {
      setLoading(false);
    }
  };

  const handleBuy = async (id: bigint) => {
    setLoading(true);
    setMessage("");
    try {
        if (!address) throw new Error("Connect wallet first.");
        const price = priceOf(id) as bigint | undefined;
        if (!price || price === 0n) throw new Error("Not for sale.");

        if (modeVal === 0) { // ETH
            await writeContractAsync({
                address: rigSaleAddress, abi: rigSaleABI as any, functionName: "buyWithETH",
                args: [id, 1n], value: price,
            });
        } else if (modeVal === 1 && tokenAddr) { // ERC20
            if ((allowance as bigint) < price) {
                await writeContractAsync({
                    address: tokenAddr as Address, abi: erc20ABI, functionName: "approve",
                    args: [rigSaleAddress, price],
                });
            }
            await writeContractAsync({
                address: rigSaleAddress, abi: rigSaleABI as any, functionName: "buyWithERC20",
                args: [id, 1n],
            });
        } else {
            throw new Error("Unsupported payment mode.");
        }
        setMessage("Purchase success!");
        onTransactionSuccess?.();
    } catch (e: any) {
        setMessage(e?.shortMessage || e?.message || "Transaction failed");
    } finally {
        setLoading(false);
    }
  };
  
  const tierId = (t: TierID) => (t === "basic" ? BASIC : t === "pro" ? PRO : LEGEND);
  const onClickCta = (t: TierID) => {
    const id = tierId(t);
    if (t === "basic" && isBasicFreeForMe) return handleClaimBasicFree;
    return () => handleBuy(id as bigint);
  };
  const ctaText = (t: TierID) => (t === "basic" && isBasicFreeForMe ? "Claim Free Rig" : "Buy");

  /* ============================
      Invite Task (Fungsi Asli Dikembalikan)
  ============================ */
  const { data: totalInvitesData } = useReadContract({
    address: rigSaleAddress,
    abi: rigSaleABI as any,
    functionName: "inviteCountOf",
    args: address ? [address as Address] : undefined,
    query: { enabled: !!address },
  });
  const totalInvites = totalInvitesData ? Number(totalInvitesData) : 0;

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

      const res = await fetch("/api/referral", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inviter: address, inc: 1 }),
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error || "Claim gagal");

      setClaimedRewards(json?.claimedRewards ?? (claimedRewards + 1));
      setInviteMsg("Reward dicatat.");
    } catch (e: any) {
      setInviteMsg(e?.shortMessage || e?.message || "Claim gagal");
    } finally {
      setBusyInvite(false);
    }
  }

  /* ============================
      Render (Struktur Asli)
  ============================ */
  return (
    <div className="space-y-4 px-4 pt-4 pb-8">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Market</h1>
        <p className="text-sm text-neutral-400">Mint &amp; Listings</p>
      </header>

      {/* Invite Task Card (UI Asli Dikembalikan) */}
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

      {/* Listing NFT (UI Asli) */}
      <div className="space-y-4">
        {NFT_DATA.map((tier) => {
          const id = tierId(tier.id);
          const price = priceOf(id);
          const isFree = tier.id === "basic" && isBasicFreeForMe;
          // PERBAIKAN: Type error di sini diperbaiki dengan cast `price as bigint`
          const priceText = isFree ? "FREE" : (price ? `${formatEther(price as bigint)} ETH` : 'N/A');
          return (
            <div key={tier.id} className="flex items-center bg-neutral-800 rounded-lg p-3 space-x-3">
              <div className="w-16 h-16 bg-neutral-700 rounded-md flex items-center justify-center relative overflow-hidden">
                <Image src={tier.image} alt={tier.name} width={64} height={64} className="object-contain" />
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
                  onClick={() => onClickCta(tier.id)()}
                  disabled={loading || !address || !id}
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
      {!!message && <p className="text-center text-xs text-neutral-400 mt-2">{message}</p>}
    </div>
  );
};

export default Market;


