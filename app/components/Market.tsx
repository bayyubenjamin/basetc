"use client";

import { useEffect, useMemo, useState } from "react";
import type { FC } from "react";
import Image from "next/image";
import { useAccount, useReadContract, useWriteContract, usePublicClient } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { rigSaleAddress, rigSaleABI, rigNftAddress, rigNftABI } from "../lib/web3Config";
import { formatEther, formatUnits, type Address, parseEther } from "viem";

// Types and constants from original file
type TierID = "basic" | "pro" | "legend";
interface NFTTier { id: TierID; name: string; image: string; description: string; }
const NFT_DATA: NFTTier[] = [
  { id: "basic", name: "Basic Rig", image: "/img/vga_basic.png", description: "Claim your first rig for free to start mining." },
  { id: "pro", name: "Pro Rig", image: "/img/vga_pro.gif", description: "Upgrade for a significant boost in hashrate." },
  { id: "legend", name: "Legend Rig", image: "/img/vga_legend.gif", description: "The ultimate rig for professional miners." },
];
const erc20ABI = [ { "inputs": [], "name": "symbol", "outputs": [{ "internalType": "string", "name": "", "type": "string" }], "stateMutability": "view", "type": "function" }, { "inputs": [], "name": "decimals", "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }], "stateMutability": "view", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "owner", "type": "address" }, { "internalType": "address", "name": "spender", "type": "address" } ], "name": "allowance", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }, { "inputs": [ { "internalType": "address", "name": "spender", "type": "address" }, { "internalType": "uint256", "name": "amount", "type": "uint256" } ], "name": "approve", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "nonpayable", "type": "function" } ] as const;


export default function Market() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const [fid, setFid] = useState<bigint | null>(null);
  const [inviter, setInviter] = useState<Address>("0x0000000000000000000000000000000000000000");

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const qFid = url.searchParams.get("fid") || localStorage.getItem("basetc_fid");
      if (qFid && /^\d+$/.test(qFid)) setFid(BigInt(qFid));

      const qRef = url.searchParams.get("ref") || localStorage.getItem("basetc_ref");
      if (qRef && /^0x[0-9a-fA-F]{40}$/.test(qRef)) setInviter(qRef as Address);
    } catch {}
  }, []);

  // Contract Reads (from original file, unchanged)
  const { data: BASIC = 1n } = useReadContract({ address: rigNftAddress, abi: rigNftABI as any, functionName: "BASIC" });
  const { data: PRO = 2n } = useReadContract({ address: rigNftAddress, abi: rigNftABI as any, functionName: "PRO" });
  const { data: LEGEND = 3n } = useReadContract({ address: rigNftAddress, abi: rigNftABI as any, functionName: "LEGEND" });
  const { data: priceBasic } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "priceOf", args: [BASIC] });
  const { data: pricePro } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "priceOf", args: [PRO] });
  const { data: priceLegend } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "priceOf", args: [LEGEND] });
  const { data: freeOpen } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "freeMintOpen" });
  const { data: freeId } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "freeMintId" });
  const { data: freeUsed, refetch: refetchFreeUsed } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI as any, functionName: "freeMintedByFid", args: fid ? [fid] : undefined, query: { enabled: !!fid } });
  const isBasicFreeForMe = freeOpen && freeId === BASIC && !freeUsed;

  const { writeContractAsync } = useWriteContract();

  const handleClaimBasicFree = async () => {
    setLoading(true);
    setMessage("");
    try {
      if (!address) throw new Error("Please connect your wallet first.");
      if (!isBasicFreeForMe) throw new Error("You are not eligible for a free mint.");
      if (!fid) throw new Error("Farcaster FID not found. Please use the app within Farcaster or provide ?fid=... in the URL.");

      setMessage("1/3: Requesting signature from server...");
      const sigResponse = await fetch("/api/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "free-sign", fid: String(fid), to: address, inviter }),
      });
      if (!sigResponse.ok) throw new Error("Failed to get signature from server.");
      const sigData = await sigResponse.json();

      setMessage("2/3: Awaiting transaction confirmation...");
      const txHash = await writeContractAsync({
        address: rigSaleAddress,
        abi: rigSaleABI as any,
        functionName: "claimFreeByFidSig",
        args: [fid, address, sigData.inviter, BigInt(sigData.deadline), sigData.v, sigData.r, sigData.s],
        account: address,
        chain: baseSepolia,
      });
      
      await publicClient?.waitForTransactionReceipt({ hash: txHash });

      setMessage("3/3: Transaction successful! Updating referral status...");
      if (inviter !== "0x0000000000000000000000000000000000000000") {
        await fetch("/api/referral", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "mark-valid", inviter, invitee_fid: String(fid), invitee_wallet: address }),
        });
      }
      
      setMessage("Claim successful!");
      refetchFreeUsed();
    } catch (e: any) {
      const errorMsg = e?.shortMessage || e?.message || "An unknown error occurred.";
      setMessage(`Error: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleBuy = async (id: bigint, price: bigint) => {
    setLoading(true);
    setMessage("");
    try {
      if (!address) throw new Error("Please connect your wallet first.");
      setMessage("Awaiting transaction confirmation...");
      const txHash = await writeContractAsync({
        address: rigSaleAddress,
        abi: rigSaleABI as any,
        functionName: "buyWithETH",
        args: [id, 1n],
        value: price,
        account: address,
        chain: baseSepolia,
      });
      await publicClient?.waitForTransactionReceipt({ hash: txHash });
      setMessage("Purchase successful!");
    } catch (e: any) {
      const errorMsg = e?.shortMessage || e?.message || "An unknown error occurred.";
      setMessage(`Error: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 px-4 pt-4 pb-8">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Market</h1>
        <p className="text-sm text-neutral-400">Mint new mining rigs to boost your hashrate.</p>
      </header>

      <div className="space-y-4">
        {NFT_DATA.map((tier) => {
          const id = tier.id === 'basic' ? BASIC : tier.id === 'pro' ? PRO : LEGEND;
          const price = tier.id === 'basic' ? priceBasic : tier.id === 'pro' ? pricePro : priceLegend;
          const isFree = tier.id === 'basic' && isBasicFreeForMe;
          const buttonDisabled = loading || !address || (isFree ? false : !price);

          return (
            <div key={tier.id} className="flex items-center bg-neutral-800 rounded-lg p-3 space-x-3">
              <div className="w-16 h-16 bg-neutral-700 rounded-md flex-shrink-0 relative"><Image src={tier.image} alt={tier.name} layout="fill" objectFit="contain" /></div>
              <div className="flex-1">
                <div className="flex items-baseline justify-between">
                  <h3 className="font-semibold">{tier.name}</h3>
                  <span className="text-sm text-neutral-400">{isFree ? "FREE" : (price ? `${formatEther(price)} ETH` : 'N/A')}</span>
                </div>
                <p className="text-xs text-neutral-400 pt-0.5">{tier.description}</p>
              </div>
              <button
                onClick={() => isFree ? handleClaimBasicFree() : handleBuy(id!, price!)}
                disabled={buttonDisabled}
                className="px-4 py-2 text-sm rounded-md bg-blue-600 hover:bg-blue-500 text-white disabled:bg-neutral-700 disabled:text-neutral-500 disabled:cursor-not-allowed"
              >
                {isFree ? 'Claim' : 'Buy'}
              </button>
            </div>
          );
        })}
      </div>
      {message && <p className="text-center text-sm text-neutral-300 mt-4">{message}</p>}
    </div>
  );
}

