"use client";

// [FIX] Memisahkan impor 'type' (FC) dari impor nilai (useState, dll.)
import type { FC } from "react";
import { useState, useEffect, useCallback } from "react";
import { formatEther } from "viem";
import { useAccount, useReadContract, useWriteContract } from "wagmi";

// Impor ABI dan alamat dari file konfigurasi terpusat
import { rigSaleABI, rigNftABI } from "../lib/abi";
import { rigSaleAddress, rigNftAddress } from "../lib/web3Config";
import { calculateMaxClaims } from "../lib/inviteMath";

// Definisi props (tidak diubah)
interface MarketProps {
  onTransactionSuccess?: () => void;
}

const Market: FC<MarketProps> = ({ onTransactionSuccess }) => {
  const { address } = useAccount();
  const [message, setMessage] = useState<string>("");
  const [claimedRewards, setClaimedRewards] = useState(0);
  const [validReferrals, setValidReferrals] = useState(0);
  const { writeContractAsync } = useWriteContract();

  // Hooks untuk membaca data dari smart contract (tidak diubah)
  const { data: proPrice } = useReadContract({
    address: rigSaleAddress, abi: rigSaleABI, functionName: "proPrice",
  });
  const { data: supremePrice } = useReadContract({
    address: rigSaleAddress, abi: rigSaleABI, functionName: "supremePrice",
  });
  const { data: freeOpen } = useReadContract({
    address: rigSaleAddress, abi: rigSaleABI, functionName: "freeMintOpen",
  });
  const { data: freeMinted } = useReadContract({
    address: rigSaleAddress, abi: rigSaleABI, functionName: "freeMintedByFid", args: [BigInt(localStorage.getItem('basetc_fid') || 0)],
  });

  // Fungsi untuk mengambil data referral dari API
  const fetchReferralData = useCallback(async () => {
    if (!address) return;
    try {
      const res = await fetch(`/api/referral?inviter=${address}`);
      const data = await res.json();
      if (data.error) return;
      setClaimedRewards(data.claimedRewards || 0);
      setValidReferrals(data.validReferrals || 0);
    } catch (e) {
      console.warn("Failed to fetch referral data:", e);
    }
  }, [address]);

  useEffect(() => {
    fetchReferralData();
  }, [fetchReferralData]);

  // Handler untuk klaim free mint (tidak diubah)
  const handleClaimBasicFree = async () => {
    try {
      setMessage("");
      if (!address) throw new Error("Please connect your wallet first.");
      if (!freeOpen) throw new Error("Free mint is not open.");
      if (freeMinted) throw new Error("You have already claimed a free mint.");
      
      const fidStr = localStorage.getItem("basetc_fid");
      if (!fidStr) throw new Error("Farcaster FID not found. Please re-open from Farcaster.");
      const fid = BigInt(fidStr);
      
      const inviterAddr = localStorage.getItem("basetc_ref") || "0x0000000000000000000000000000000000000000";

      setMessage("1/3: Requesting signature...");
      const res = await fetch("/api/referral", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "free-sign", fid: String(fid), to: address, inviter: inviterAddr }),
      });
      const sigData = await res.json();
      if (sigData.error) throw new Error(sigData.error);

      setMessage("2/3: Awaiting transaction...");
      await writeContractAsync({
        address: rigSaleAddress, abi: rigSaleABI, functionName: "claimFreeByFidSig",
        args: [fid, sigData.to, sigData.inviter, BigInt(sigData.deadline), sigData.v, sigData.r, sigData.s],
      });

      setMessage("3/3: Finalizing...");
      await fetch("/api/referral", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "mark-valid", invitee_fid: String(fid), invitee_wallet: address }),
      });
      
      setMessage("Free mint success!");
      onTransactionSuccess?.();
    } catch (e: any) {
      setMessage(e?.shortMessage || e?.message || "Claim failed");
    }
  };

  // Handler untuk klaim reward referral
  const handleClaimReferralReward = async (amount: number) => {
    if (!address || amount <= 0) return;
    try {
      setMessage("");
      setMessage(`Claiming ${amount} reward(s)...`);
      await writeContractAsync({
        address: rigSaleAddress, abi: rigSaleABI, functionName: 'claimFromInvites', args: [BigInt(amount)]
      });

      await fetch('/api/referral', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ inviter: address, inc: amount })
      });
      
      setMessage(`Successfully claimed ${amount} reward(s)!`);
      fetchReferralData(); // Refresh data
      onTransactionSuccess?.();
    } catch (e: any) {
      setMessage(e?.shortMessage || e?.message || "Claim failed");
    }
  };

  // Handler untuk pembelian (tidak diubah)
  const handleBuy = async (tier: "pro" | "supreme") => {
    try {
      setMessage("");
      if (!address) throw new Error("Please connect your wallet first.");
      const price = tier === "pro" ? proPrice : supremePrice;
      if (typeof price !== "bigint") throw new Error("Price not loaded yet.");
      
      setMessage(`Purchasing ${tier} rig...`);
      await writeContractAsync({
        address: rigSaleAddress, abi: rigSaleABI, functionName: "buy",
        args: [tier === "pro" ? 1 : 2], value: price
      });
      setMessage(`${tier.charAt(0).toUpperCase() + tier.slice(1)} rig purchased successfully!`);
      onTransactionSuccess?.();
    } catch (e: any) {
      setMessage(e?.shortMessage || e?.message || "Purchase failed.");
    }
  };

  const maxClaims = calculateMaxClaims(validReferrals);
  const availableClaims = maxClaims - claimedRewards;

  return (
    <div className="p-4 space-y-4">
      <div className="text-center font-bold text-lg">Market</div>

      {/* Free Basic Rig */}
      <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-4 space-y-2">
        <div className="font-bold">Claim Free Basic Rig</div>
        <div className="text-sm text-neutral-400">Claim your first rig for free via Farcaster.</div>
        <button
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-600 text-white font-bold py-2 px-4 rounded-md"
          onClick={handleClaimBasicFree}
          disabled={!freeOpen || !!freeMinted}
        >
          {freeMinted ? "Already Claimed" : (freeOpen ? "Claim Free Rig" : "Claim Closed")}
        </button>
      </div>

      {/* Referral Rewards */}
      <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-4 space-y-2">
        <div className="font-bold">Referral Rewards</div>
        <div className="text-sm text-neutral-400">Claim rewards from your valid invites. You have {availableClaims} claim(s) available.</div>
        <button
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-neutral-600 text-white font-bold py-2 px-4 rounded-md"
          onClick={() => handleClaimReferralReward(availableClaims)}
          disabled={availableClaims <= 0}
        >
          {`Claim ${availableClaims} Reward(s)`}
        </button>
      </div>

      {/* Purchase Rigs */}
      <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-4 space-y-2">
        <div className="font-bold">Purchase Pro Rig</div>
        <div className="text-sm text-neutral-400">Price: {proPrice ? `${formatEther(proPrice)} ETH` : "Loading..."}</div>
        <button
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-neutral-600 text-white font-bold py-2 px-4 rounded-md"
          onClick={() => handleBuy("pro")}
          disabled={typeof proPrice !== "bigint"}
        >
          Buy Pro Rig
        </button>
      </div>

      <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-4 space-y-2">
        <div className="font-bold">Purchase Supreme Rig</div>
        <div className="text-sm text-neutral-400">Price: {supremePrice ? `${formatEther(supremePrice)} ETH` : "Loading..."}</div>
        <button
          className="w-full bg-yellow-500 hover:bg-yellow-600 disabled:bg-neutral-600 text-black font-bold py-2 px-4 rounded-md"
          onClick={() => handleBuy("supreme")}
          disabled={typeof supremePrice !== "bigint"}
        >
          Buy Supreme Rig
        </button>
      </div>

      {message && <div className="text-center text-sm text-neutral-300 break-words">{message}</div>}
    </div>
  );
};

export default Market;


