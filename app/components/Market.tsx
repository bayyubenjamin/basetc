"use client";

import { useEffect, useMemo, useState } from "react";
import type { FC } from "react";
import Image from "next/image"; // <-- Tambahkan impor ini
import {
  useAccount,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { baseSepolia } from "wagmi/chains"; // ← PENTING: pakai wagmi/chains, bukan viem/chains
import {
  rigSaleAddress,
  rigSaleABI,
  rigNftAddress,
  rigNftABI,
} from "../lib/web3Config";
import { formatEther, formatUnits } from "viem";

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
  { id: "pro",    name: "Pro Rig",    image: "/img/vga_pro.png",    hashrateHint: "~5.0 H/s",  description: "Upgrade for a significant boost in hashrate." },
  { id: "legend", name: "Legend Rig", image: "/img/vga_legend.png", hashrateHint: "~25.0 H/s", description: "The ultimate rig for professional miners." },
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
  const freeMineRes = useReadContract({
    address: rigSaleAddress, abi: rigSaleABI as any, functionName: "freeMinted",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });
  const freeOpen  = Boolean(freeOpenRes.data);
  const freeId    = freeIdRes.data as bigint | undefined;
  const freeUsed  = Boolean(freeMineRes.data);
  const isBasicFreeForMe = freeOpen && BASIC !== undefined && freeId === BASIC && !freeUsed;

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
  const handleClaimBasicFree = async () => {
    try {
      setMessage("");
      if (!address) return setMessage("Connect wallet first.");
      if (!isBasicFreeForMe) return setMessage("No free mint available.");

      await writeContractAsync({
        address: rigSaleAddress,
        abi: rigSaleABI as any,
        functionName: "claimFree",
        args: [],
        account: address as `0x${string}`,
        chain: baseSepolia, // ← tambahkan chain + account
      });

      setMessage("Claim success!");
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
    if (t === "basic" && isBasicFreeForMe) return () => handleClaimBasicFree();
    return () => handleBuy(id);
  };
  const ctaText = (t: TierID) => (t === "basic" && isBasicFreeForMe ? "Claim Free Rig" : "Buy");

  return (
    <div className="space-y-4 px-4 pt-4 pb-8">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Market</h1>
        <p className="text-sm text-neutral-400">Mint &amp; Listings</p>
      </header>

      <div className="text-[11px] text-neutral-400">
        Mode: {modeVal === 0 ? "ETH" : modeVal === 1 ? `Token (${tokenSymbol})` : "—"}
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

      {!!message && <p className="text-xs text-green-400">{message}</p>}
    </div>
  );
};

export default Market;
