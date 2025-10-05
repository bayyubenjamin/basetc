"use client";

/* =============================
   Market (Design-aligned, logic intact)
   - All comments in English
============================= */

import { useEffect, useMemo, useState, type FC } from "react";
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

/* ---------- Invite math (original behavior kept) ---------- */
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

/* ---------- Minimal ERC20 ABI ---------- */
const erc20ABI = [
  { type: "function", name: "symbol",    stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals",  stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  {
    type: "function", name: "allowance", stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
    outputs: [{ type: "uint256" }]
  },
  {
    type: "function", name: "approve", stateMutability: "nonpayable",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ type: "bool" }]
  },
] as const;

/* ---------- UI data ---------- */
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
  { id: "pro",    name: "Pro Rig",    image: "/img/vga_pro.gif",    hashrateHint: "~5.0 H/s",  description: "Upgrade to significantly increase hashrate." },
  { id: "legend", name: "Legend Rig", image: "/img/vga_legend.gif", hashrateHint: "~25.0 H/s", description: "Top-tier rig for maximum performance." },
];

export interface MarketProps { onTransactionSuccess?: () => void; }

const Market: FC<MarketProps> = ({ onTransactionSuccess }) => {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);

  /* ---------- Load FID & inviter BEFORE reads that depend on them ---------- */
  const [fid, setFid] = useState<bigint | null>(null);
  const [inviter, setInviter] = useState<Address>("0x0000000000000000000000000000000000000000");
  useEffect(() => {
    try {
      const storedFid = typeof window !== "undefined" ? window.localStorage.getItem("basetc_fid") : null;
      if (storedFid) setFid(BigInt(storedFid));
      const storedRef = typeof window !== "undefined" ? window.localStorage.getItem("basetc_ref") : null;
      if (storedRef && /^0x[0-9a-fA-F]{40}$/.test(storedRef)) {
        setInviter(storedRef as Address);
      }
    } catch {
      // ignore
    }
  }, []);

  /* ---------- NFT tier ids ---------- */
  const { data: BASIC }  = useReadContract({ address: rigNftAddress, abi: rigNftABI as any, functionName: "BASIC" });
  const { data: PRO }    = useReadContract({ address: rigNftAddress, abi: rigNftABI as any, functionName: "PRO" });
  const { data: LEGEND } = useReadContract({ address: rigNftAddress, abi: rigNftABI as any, functionName: "LEGEND" });

  /* ---------- Sale mode & token ---------- */
  const { data: modeVal }    = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "currentMode" }); // 0=ETH,1=ERC20
  const { data: tokenAddr }  = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "paymentToken" });

  /* If ERC20, load decimals & symbol (only when mode === 1 and token exists) */
  const isERC20 = (modeVal as number | undefined) === 1 && !!tokenAddr;
  const { data: tokenDecimalsData } = useReadContract({
    address: tokenAddr as Address, abi: erc20ABI as any, functionName: "decimals",
    query: { enabled: Boolean(isERC20) },
  });
  const { data: tokenSymbolData } = useReadContract({
    address: tokenAddr as Address, abi: erc20ABI as any, functionName: "symbol",
    query: { enabled: Boolean(isERC20) },
  });
  const tokenDecimals = (tokenDecimalsData as number | undefined) ?? 18;
  const tokenSymbol   = (tokenSymbolData   as string | undefined) ?? "TOKEN";

  /* ---------- Active prices ---------- */
  const { data: priceBasic }  = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "priceOf", args: [BASIC],  query: { enabled: !!BASIC } });
  const { data: pricePro }    = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "priceOf", args: [PRO],    query: { enabled: !!PRO } });
  const { data: priceLegend } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "priceOf", args: [LEGEND], query: { enabled: !!LEGEND } });

  const priceOf = (id: unknown) => {
    if (id === BASIC)  return priceBasic as bigint | undefined;
    if (id === PRO)    return pricePro as bigint | undefined;
    if (id === LEGEND) return priceLegend as bigint | undefined;
    return undefined;
  };

  /* ---------- Free mint status ---------- */
  const { data: freeOpenRaw } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "freeMintOpen" });
  const { data: freeId }      = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "freeMintId" });

  // Read "already used free mint by FID". Only enable AFTER fid is known.
  const { data: freeUsedRaw, refetch: refetchFreeUsed } = useReadContract({
    address: rigSaleAddress,
    abi: rigSaleABI as any,
    functionName: "freeMintedByFid",
    args: fid !== null ? [fid] : undefined,
    query: { enabled: fid !== null },
  });

  // Normalize types for safe checks
  const freeOpen  = Boolean(freeOpenRaw as boolean | undefined);
  const freeUsed  = Boolean(freeUsedRaw as boolean | undefined);
  const freeBasic = BASIC !== undefined && freeId === (BASIC as unknown as bigint);

  // This is the final gate for showing "Claim Free Rig" CTA
  const isBasicFreeForMe = Boolean(freeOpen && freeBasic && !freeUsed);

  /* ---------- ERC20 allowance (only when needed) ---------- */
  const { data: allowanceData } = useReadContract({
    address: tokenAddr as Address,
    abi: erc20ABI as any,
    functionName: "allowance",
    args: address && tokenAddr ? [address, rigSaleAddress] : undefined,
    query: { enabled: Boolean(address && isERC20) },
  });
  const allowance = (allowanceData as bigint | undefined) ?? 0n;

  /* ---------- Writer ---------- */
  const { writeContractAsync } = useWriteContract();

  /* ---------- Handlers ---------- */
  const handleClaimBasicFree = async () => {
    setLoading(true);
    setMessage("");
    try {
      if (!address) throw new Error("Please connect wallet first.");
      if (!isBasicFreeForMe) throw new Error("Not eligible for free mint.");
      if (fid === null) throw new Error("Farcaster FID not found. Open this mini app from Farcaster.");

      // Ask server for signature (referral-aware)
      setMessage("Requesting server signature…");
      const sigRes = await fetch("/api/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "free-sign",
          fid: String(fid),
          to: address,
          inviter,
        }),
      });
      const sigData = await sigRes.json();
      if (!sigRes.ok) throw new Error(sigData?.error || "Failed to get signature.");

      // Send tx
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

      // Mark referral (optional)
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

  const handleBuy = async (id: bigint) => {
    setLoading(true);
    setMessage("");
    try {
      if (!address) throw new Error("Please connect wallet first.");
      const price = priceOf(id);
      if (!price || price === 0n) throw new Error("Not for sale.");

      const mode = modeVal as number | undefined;
      if (mode === 0) {
        // ETH mode
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
      } else if (mode === 1 && tokenAddr) {
        // ERC20 mode
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
        throw new Error("Unsupported/unknown payment mode.");
      }

      setMessage("Purchase success!");
      onTransactionSuccess?.();
    } catch (e: any) {
      setMessage(e?.shortMessage || e?.message || "Transaction failed");
    } finally {
      setLoading(false);
    }
  };

  const tierId = (t: TierID) => (t === "basic" ? (BASIC as bigint | undefined) : t === "pro" ? (PRO as bigint | undefined) : (LEGEND as bigint | undefined));
  const onClickCta = (t: TierID) => {
    const id = tierId(t);
    if (t === "basic" && isBasicFreeForMe) return handleClaimBasicFree;
    return () => id && handleBuy(id);
  };
  const ctaText = (t: TierID) => (t === "basic" && isBasicFreeForMe ? "Claim Free Rig" : "Buy");

  /* ---------- Invite task (original behavior) ---------- */
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

  const maxClaims   = useMemo(() => maxClaimsFrom(totalInvites), [totalInvites]);
  const available   = Math.max(0, maxClaims - claimedRewards);
  const needMoreInv = invitesNeededForNext(totalInvites, claimedRewards);

  const [inviteMsg, setInviteMsg] = useState<string>("");
  const [busyInvite, setBusyInvite] = useState(false);

  async function handleClaimInviteReward() {
    try {
      if (!address) return setInviteMsg("Please connect wallet.");
      setInviteMsg("");
      if (available <= 0) {
        return setInviteMsg(`Need ${needMoreInv} more valid invite(s) for the next claim.`);
      }
      setBusyInvite(true);

      const res = await fetch("/api/referral", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inviter: address, inc: 1 }),
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error || "Claim failed.");

      setClaimedRewards(json?.claimedRewards ?? (claimedRewards + 1));
      setInviteMsg("Reward recorded.");
    } catch (e: any) {
      setInviteMsg(e?.shortMessage || e?.message || "Claim failed.");
    } finally {
      setBusyInvite(false);
    }
  }

  /* ---------- Price label helper ---------- */
  const mode = modeVal as number | undefined;

  /* ---------- UI ---------- */
  return (
    <div className="space-y-4 px-4 pt-4 pb-24">
      <header className="fin-page-head !px-0 !pt-0">
        <h1>Market</h1>
        <p>Mint rigs and invite to earn</p>
      </header>

      {/* Invite card (simplified, professional) */}
      <section className="rounded-2xl px-4 py-3 bg-[#0f1426]/70 backdrop-blur border border-white/5 shadow-[0_8px_25px_rgba(0,0,0,.35)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-semibold">Invite Friends</h3>
            <p className="text-sm text-neutral-400">Valid invites unlock free Basic rig claims.</p>
            <div className="mt-2 text-xs text-neutral-300">
              Invites: <b>{totalInvites}</b> • Claimed: <b>{claimedRewards}</b> • Max now: <b>{maxClaims}</b>
              <br />
              {available > 0
                ? <span>You have <b>{available}</b> pending claim(s).</span>
                : <span>Need <b>{needMoreInv}</b> more valid invite(s) for the next claim.</span>}
            </div>
            {!!inviteMsg && <div className="mt-2 text-xs opacity-90">{inviteMsg}</div>}
          </div>

          <button
            onClick={handleClaimInviteReward}
            disabled={busyInvite || available <= 0}
            className={`px-4 py-2 rounded-xl font-semibold ${
              available > 0 ? "bg-indigo-500 text-white hover:bg-indigo-400" : "bg-neutral-700 text-neutral-400 cursor-not-allowed"
            }`}
          >
            {busyInvite ? "Claiming…" : "Claim"}
          </button>
        </div>
      </section>

      {/* Listing cards */}
      <div className="space-y-4">
        {NFT_DATA.map((tier) => {
          const id = tierId(tier.id);
          const p  = id ? priceOf(id) : undefined;

          // Price label: ETH vs ERC20 vs FREE
          const priceText =
            tier.id === "basic" && isBasicFreeForMe
              ? "FREE"
              : p !== undefined
                ? (mode === 0
                    ? `${formatEther(p as bigint)} ETH`
                    : mode === 1
                      ? `${formatUnits(p as bigint, tokenDecimals)} ${tokenSymbol}`
                      : "N/A")
                : "N/A";

          const disabled = loading || !address || !id || (tier.id === "basic" && !isBasicFreeForMe && !p);

          return (
            <div
              key={tier.id}
              className="flex items-center rounded-2xl px-3 py-3 bg-[#0f1426]/70 backdrop-blur border border-white/5 shadow-[0_8px_25px_rgba(0,0,0,.35)] gap-3"
            >
              <div className="w-16 h-16 rounded-md bg-black/20 flex items-center justify-center overflow-hidden">
                <Image src={tier.image} alt={tier.name} width={64} height={64} className="object-contain" />
              </div>

              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-sm md:text-base">{tier.name}</h3>
                    <p className="text-xs text-neutral-400">{tier.description}</p>
                    <p className="text-xs text-neutral-400 pt-0.5">Est. Hashrate: {tier.hashrateHint}</p>
                  </div>
                  <span className="text-xs md:text-sm text-neutral-300 whitespace-nowrap mt-0.5">{priceText}</span>
                </div>
              </div>

              <div>
                <button
                  onClick={() => onClickCta(tier.id)()}
                  disabled={Boolean(disabled)}
                  className={`px-3 py-2 text-xs rounded-xl font-semibold ${
                    disabled
                      ? "bg-neutral-700 text-neutral-500 cursor-not-allowed"
                      : "bg-indigo-500 hover:bg-indigo-400 text-white"
                  }`}
                >
                  {ctaText(tier.id)}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {!!message && <p className="text-center text-xs text-neutral-300 mt-2">{message}</p>}
    </div>
  );
};

export default Market;

