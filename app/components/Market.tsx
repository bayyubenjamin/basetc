// app/components/Market.tsx
"use client";

import { useEffect, useMemo, useState, type FC } from "react";
import Image from "next/image";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  usePublicClient,
} from "wagmi";
import { baseSepolia } from "viem/chains";
import { formatEther, formatUnits, type Address } from "viem";

import {
  rigSaleAddress,
  rigSaleABI,
  rigNftAddress,
  rigNftABI,
} from "../lib/web3Config";

/* =============================
   Invite Math (original behavior)
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
   Minimal ERC20 ABI
============================= */
const erc20ABI = [
  { type: "function", name: "symbol",    stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals",  stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
] as const;

/* =============================
   UI data for tiers
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
  { id: "basic",  name: "Basic Rig",  image: "/img/vga_basic.png",  hashrateHint: "~1.5 H/s",  description: "Claim a free starter rig to begin mining." },
  { id: "pro",    name: "Pro Rig",    image: "/img/vga_pro.gif",    hashrateHint: "~5.0 H/s",  description: "Upgrade for a significant increase in hashrate." },
  { id: "legend", name: "Legend Rig", image: "/img/vga_legend.gif", hashrateHint: "~25.0 H/s", description: "Top-tier rig for maximum performance." },
];

export interface MarketProps { onTransactionSuccess?: () => void; }

const Market: FC<MarketProps> = ({ onTransactionSuccess }) => {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);

  /* ------------------------------------------
     Load NFT tier IDs from RigNFT (BASIC/PRO/LEGEND)
  ------------------------------------------ */
  const { data: BASIC }  = useReadContract({ address: rigNftAddress, abi: rigNftABI as any, functionName: "BASIC" });
  const { data: PRO }    = useReadContract({ address: rigNftAddress, abi: rigNftABI as any, functionName: "PRO" });
  const { data: LEGEND } = useReadContract({ address: rigNftAddress, abi: rigNftABI as any, functionName: "LEGEND" });

  /* ------------------------------------------
     Payment mode & token (defensive defaults)
     Mode: 0 = ETH, 1 = ERC20
  ------------------------------------------ */
  const { data: modeVal }   = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "currentMode" });
  const { data: tokenAddr } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "paymentToken" });
  const mode = Number(modeVal ?? 0);
  const isERC20 = mode === 1 && !!tokenAddr;

  const { data: tokenDecimalsData } = useReadContract({
    address: tokenAddr as Address,
    abi: erc20ABI as any,
    functionName: "decimals",
    query: { enabled: Boolean(isERC20) },
  });
  const { data: tokenSymbolData } = useReadContract({
    address: tokenAddr as Address,
    abi: erc20ABI as any,
    functionName: "symbol",
    query: { enabled: Boolean(isERC20) },
  });
  const tokenDecimals = (tokenDecimalsData as number | undefined) ?? 18;
  const tokenSymbol   = (tokenSymbolData   as string | undefined) ?? "TOKEN";

  /* ------------------------------------------
     Active prices for each ID (from RigSale)
  ------------------------------------------ */
  const { data: priceBasic }  = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "priceOf", args: [BASIC],  query: { enabled: !!BASIC  } });
  const { data: pricePro }    = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "priceOf", args: [PRO],    query: { enabled: !!PRO    } });
  const { data: priceLegend } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "priceOf", args: [LEGEND], query: { enabled: !!LEGEND } });

  const priceOf = (id: unknown) => {
    if (id === BASIC)  return priceBasic as bigint | undefined;
    if (id === PRO)    return pricePro as bigint | undefined;
    if (id === LEGEND) return priceLegend as bigint | undefined;
    return undefined;
  };

  /* ------------------------------------------
     Free mint config & status
  ------------------------------------------ */
  const { data: freeOpenRaw } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "freeMintOpen" });
  const { data: freeId }      = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "freeMintId" });

  // Read FID and inviter from localStorage first
  const [fid, setFid] = useState<bigint | null>(null);
  const [inviter, setInviter] = useState<Address>("0x0000000000000000000000000000000000000000");
  useEffect(() => {
    try {
      const storedFid = typeof window !== "undefined" ? window.localStorage.getItem("basetc_fid") : null;
      if (storedFid) setFid(BigInt(storedFid));
      const storedRef = typeof window !== "undefined" ? window.localStorage.getItem("basetc_ref") : null;
      if (storedRef && /^0x[0-9a-fA-F]{40}$/.test(storedRef)) setInviter(storedRef as Address);
    } catch {/* ignore */}
  }, []);

  // Query freeMintedByFid ONLY when fid is available
  const {
    data: freeUsedRaw,
    refetch: refetchFreeUsed,
    isLoading: freeUsedLoading,
  } = useReadContract({
    address: rigSaleAddress,
    abi: rigSaleABI as any,
    functionName: "freeMintedByFid",
    args: fid !== null ? [fid] : undefined,
    query: { enabled: fid !== null },
  });

  const freeOpen  = Boolean(freeOpenRaw as boolean | undefined);
  const freeUsed  = Boolean(freeUsedRaw as boolean | undefined);
  const freeBasic = BASIC !== undefined && freeId === (BASIC as unknown as bigint);

  // While freeUsed is loading, we optimistically show FREE CTA (blocked in handler if already used)
  const isBasicFreeForMe = Boolean(freeOpen && freeBasic && fid !== null && (freeUsedLoading ? true : !freeUsed));

  /* ------------------------------------------
     ERC20 allowance (only for ERC20 mode)
  ------------------------------------------ */
  const { data: allowanceData = 0n } = useReadContract({
    address: tokenAddr as Address,
    abi: erc20ABI as any,
    functionName: "allowance",
    args: address && tokenAddr ? [address, rigSaleAddress] : undefined,
    query: { enabled: Boolean(address && isERC20) },
  });
  const allowance = allowanceData as bigint;

  /* ------------------------------------------
     Writer
  ------------------------------------------ */
  const { writeContractAsync } = useWriteContract();

  /* ------------------------------------------
     FREE claim handler
  ------------------------------------------ */
  const handleClaimBasicFree = async () => {
    setLoading(true);
    setMessage("");
    try {
      if (!address) throw new Error("Please connect wallet first.");
      if (fid === null) throw new Error("Farcaster FID not found. Open from Farcaster.");
      if (!freeOpen) throw new Error("Free mint is currently closed.");
      if (!freeBasic) throw new Error("Free mint is not configured for BASIC.");
      if (!freeUsedLoading && freeUsed) throw new Error("Free mint already used.");

      setMessage("Requesting server signature…");
      const sigRes = await fetch("/api/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "free-sign", fid: String(fid), to: address, inviter }),
      });
      const sigData = await sigRes.json();
      if (!sigRes.ok) throw new Error(sigData?.error || "Failed to get signature from server.");

      setMessage("Awaiting transaction confirmation…");
      const txHash = await writeContractAsync({
        address: rigSaleAddress,
        abi: rigSaleABI as any,
        functionName: "claimFreeByFidSig",
        args: [fid, address, sigData.inviter, BigInt(sigData.deadline), sigData.v, sigData.r, sigData.s],
        account: address,
        chain: baseSepolia,
      });
      await publicClient?.waitForTransactionReceipt({ hash: txHash });

      // Mark referral valid on server (best-effort)
      if (inviter !== "0x0000000000000000000000000000000000000000") {
        await fetch("/api/referral", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "mark-valid", invitee_fid: String(fid), invitee_wallet: address }),
        });
      }

      setMessage("Claim successful!");
      refetchFreeUsed?.();
      onTransactionSuccess?.();
    } catch (e: any) {
      setMessage(e?.shortMessage || e?.message || "Transaction failed");
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------------------
     BUY handler (ETH default; ERC20 when mode==1)
  ------------------------------------------ */
  const handleBuy = async (id: bigint) => {
    setLoading(true);
    setMessage("");
    try {
      if (!address) throw new Error("Please connect wallet first.");
      const price = priceOf(id);
      if (!price || price === 0n) throw new Error("Not for sale.");

      if (isERC20 && tokenAddr) {
        // Ensure allowance
        if (allowance < price) {
          const approveTx = await writeContractAsync({
            address: tokenAddr as Address,
            abi: erc20ABI,
            functionName: "approve",
            args: [rigSaleAddress, price],
            account: address,
            chain: baseSepolia,
          });
          await publicClient?.waitForTransactionReceipt({ hash: approveTx });
        }
        const tx = await writeContractAsync({
          address: rigSaleAddress,
          abi: rigSaleABI as any,
          functionName: "buyWithERC20",
          args: [id, 1n],
          account: address,
          chain: baseSepolia,
        });
        await publicClient?.waitForTransactionReceipt({ hash: tx });
      } else {
        // Default safe path: ETH
        const tx = await writeContractAsync({
          address: rigSaleAddress,
          abi: rigSaleABI as any,
          functionName: "buyWithETH",
          args: [id, 1n],
          value: price,
          account: address,
          chain: baseSepolia,
        });
        await publicClient?.waitForTransactionReceipt({ hash: tx });
      }

      setMessage("Purchase success!");
      onTransactionSuccess?.();
    } catch (e: any) {
      setMessage(e?.shortMessage || e?.message || "Transaction failed");
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------------------
     Invite task (original behavior)
  ------------------------------------------ */
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
      .then((r) => r.json())
      .then((d) => setClaimedRewards(d?.claimedRewards ?? 0))
      .catch(() => {});
  }, [address]);

  const maxClaims = useMemo(() => maxClaimsFrom(totalInvites), [totalInvites]);
  const availableClaims = Math.max(0, maxClaims - claimedRewards);
  const needMoreInv = invitesNeededForNext(totalInvites, claimedRewards);

  const [inviteMsg, setInviteMsg] = useState<string>("");
  const [busyInvite, setBusyInvite] = useState(false);

  async function handleClaimInviteReward() {
    try {
      if (!address) return setInviteMsg("Please connect wallet first.");
      setInviteMsg("");
      if (availableClaims <= 0) {
        return setInviteMsg(`Need ${needMoreInv} more valid invite(s) for the next claim.`);
      }
      setBusyInvite(true);

      const res = await fetch("/api/referral", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inviter: address, inc: 1 }),
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error || "Claim failed");

      setClaimedRewards(json?.claimedRewards ?? (claimedRewards + 1));
      setInviteMsg("Reward recorded.");
    } catch (e: any) {
      setInviteMsg(e?.shortMessage || e?.message || "Claim failed");
    } finally {
      setBusyInvite(false);
    }
  }

  /* ------------------------------------------
     Helpers for CTA & price label
  ------------------------------------------ */
  const tierId = (t: TierID) => (t === "basic" ? (BASIC as bigint | undefined) : t === "pro" ? (PRO as bigint | undefined) : (LEGEND as bigint | undefined));
  const onClickCta = (t: TierID) => {
    const id = tierId(t);
    if (!id) return () => {};
    if (t === "basic" && isBasicFreeForMe) return handleClaimBasicFree;
    return () => handleBuy(id);
  };
  const ctaText = (t: TierID) => (t === "basic" && isBasicFreeForMe ? "Claim Free Rig" : "Buy");

  /* ------------------------------------------
     Render
  ------------------------------------------ */
  return (
    <div className="space-y-4 px-4 pt-4 pb-24">
      <header className="fin-page-head">
        <h1>Market</h1>
        <p>Mint rigs and invite to earn</p>
      </header>

      {/* Invite Task card (simplified/clean) */}
      <div className="fin-card-trans px-4 py-3 mx-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm opacity-80">Invite Friends → Free Basic</div>
            <div className="text-base font-semibold">1 • 2× up to 10 • 3× afterwards</div>
            <div className="mt-1 text-sm opacity-80">
              Invites: <b>{totalInvites}</b> · Claimed: <b>{claimedRewards}</b> · Max now: <b>{maxClaims}</b>
            </div>
            {availableClaims <= 0 && (
              <div className="text-xs opacity-70">Need <b>{needMoreInv}</b> more valid invite(s) for the next claim.</div>
            )}
          </div>
          <button
            onClick={handleClaimInviteReward}
            disabled={busyInvite || availableClaims <= 0}
            className={`px-4 py-2 rounded-xl font-semibold ${
              availableClaims > 0 ? "bg-indigo-500 text-white hover:bg-indigo-400" : "bg-neutral-700 text-neutral-400 cursor-not-allowed"
            }`}
          >
            {busyInvite ? "Claiming…" : `Claim${availableClaims > 0 ? ` (${availableClaims})` : ""}`}
          </button>
        </div>
        {!!inviteMsg && <div className="mt-2 text-sm opacity-90">{inviteMsg}</div>}
      </div>

      {/* Listings */}
      <div className="space-y-4">
        {NFT_DATA.map((tier) => {
          const id = tierId(tier.id);
          const p = id ? priceOf(id) : undefined;

          const priceText =
            tier.id === "basic" && isBasicFreeForMe
              ? "FREE"
              : p !== undefined
                ? (isERC20 && tokenAddr
                    ? `${formatUnits(p as bigint, tokenDecimals)} ${tokenSymbol}`
                    : `${formatEther(p as bigint)} ETH`)
                : "—";

          return (
            <div key={tier.id} className="fin-card-trans flex items-center p-3 gap-3 mx-2">
              <div className="w-16 h-16 bg-neutral-900/40 rounded-md flex items-center justify-center relative overflow-hidden">
                <Image src={tier.image} alt={tier.name} width={64} height={64} className="object-contain" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-semibold text-sm md:text-base">{tier.name}</h3>
                  <span className="text-xs md:text-sm opacity-80 shrink-0">{priceText}</span>
                </div>
                <p className="text-xs opacity-80 pt-0.5 truncate">{tier.description}</p>
                <p className="text-xs opacity-70 pt-0.5">Est. Hashrate: {tier.hashrateHint}</p>
              </div>

              <div>
                <button
                  onClick={onClickCta(tier.id)}
                  disabled={loading || !address || !id}
                  className="px-3 py-1.5 text-xs rounded-md bg-indigo-500 text-white hover:bg-indigo-400 disabled:bg-neutral-700 disabled:text-neutral-500"
                  title={!address ? "Connect wallet first" : undefined}
                >
                  {ctaText(tier.id)}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {!!message && <p className="text-center text-xs opacity-80 mt-2">{message}</p>}
    </div>
  );
};

export default Market;

