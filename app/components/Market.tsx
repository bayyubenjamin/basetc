"use client";

import { FC, useState, useEffect, useCallback } from "react";
import { formatEther } from "viem";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";

// [FIX 1] Mengoreksi path impor untuk file ABI JSON.
// Setiap ABI diimpor dari file .json-nya masing-masing.
import rigSaleABI from "../lib/abi/rigSale.json";
import rigNftABI from "../lib/abi/rigNft.json";
import { rigSaleAddress, rigNftAddress } from "../lib/web3Config";
import { calculateMaxClaims } from "../lib/inviteMath";

// Tipe props, mempertahankan yang sudah ada
interface MarketProps {
  onTransactionSuccess?: () => void;
}

const Market: FC<MarketProps> = ({ onTransactionSuccess }) => {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  // State untuk menampilkan pesan ke pengguna (loading, success, error)
  const [message, setMessage] = useState<string>("");
  // State untuk hash transaksi, agar kita bisa menunggu konfirmasinya
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  // State untuk statistik referral pengguna
  const [referralStats, setReferralStats] = useState({ validReferrals: 0, claimedRewards: 0 });

  // === Hooks untuk membaca data dari Smart Contract (TIDAK DIUBAH) ===
  const { data: freeMintId } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI, functionName: 'freeMintId' });
  const { data: freeOpen } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI, functionName: 'freeMintOpen' });
  const { data: freeMinted } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI, functionName: 'freeMintedByFid', args: [BigInt(localStorage.getItem('basetc_fid')||'0')] });
  const { data: basicPrice } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI, functionName: 'price', args: [0] });
  const { data: proPrice } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI, functionName: 'price', args: [1] });
  const { data: supremePrice } = useReadContract({ address: rigSaleAddress, abi: rigSaleABI, functionName: 'price', args: [2] });
  const { data: basicSupply } = useReadContract({ address: rigNftAddress, abi: rigNftABI, functionName: 'totalSupply', args: [0]});
  const { data: proSupply } = useReadContract({ address: rigNftAddress, abi: rigNftABI, functionName: 'totalSupply', args: [1]});
  const { data: supremeSupply } = useReadContract({ address: rigNftAddress, abi: rigNftABI, functionName: 'totalSupply', args: [2]});

  // Hook untuk menunggu konfirmasi transaksi di blockchain
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  // useEffect untuk mengambil statistik referral saat komponen dimuat atau wallet berubah
  const fetchReferralStats = useCallback(async () => {
      if (address) {
          try {
              const statsRes = await fetch(`/api/referral?inviter=${address}`);
              if (statsRes.ok) {
                  const stats = await statsRes.json();
                  setReferralStats(stats);
              }
          } catch (e) {
              console.warn("Could not fetch referral stats:", e);
          }
      }
  }, [address]);

  useEffect(() => {
      fetchReferralStats();
  }, [fetchReferralStats]);

  // useEffect untuk menangani feedback setelah transaksi dikonfirmasi
  useEffect(() => {
      if (isConfirmed) {
          setMessage("Transaction confirmed successfully!");
          onTransactionSuccess?.(); // Panggil callback jika ada
          fetchReferralStats(); // Ambil ulang data referral terbaru
          setTxHash(undefined);
      }
  }, [isConfirmed, onTransactionSuccess, fetchReferralStats]);

  // Kalkulasi jumlah klaim yang tersedia
  const availableClaims = calculateMaxClaims(referralStats.validReferrals) - referralStats.claimedRewards;
  
  // Logika untuk "Claim Free Rig"
  const handleClaimBasicFree = async () => {
    setMessage("");
    setTxHash(undefined);
    try {
      if (!address) throw new Error("Please connect your wallet first.");
      if (!freeOpen) throw new Error("Free mint is currently not open.");
      if (freeMinted) throw new Error("You have already claimed your free rig.");

      const fidStr = localStorage.getItem("basetc_fid");
      if (!fidStr) throw new Error("Farcaster FID not found. Please open from a Farcaster client.");
      
      const inviterAddr = localStorage.getItem("basetc_ref") || "0x0000000000000000000000000000000000000000";

      setMessage("Requesting signature from server...");
      const res = await fetch("/api/referral", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "free-sign", fid: fidStr, to: address, inviter: inviterAddr }),
      });
      const sigData = await res.json();
      if (!res.ok || sigData.error) throw new Error(sigData.error || "Failed to get signature.");

      setMessage("Please confirm the transaction in your wallet...");
      const hash = await writeContractAsync({
        address: rigSaleAddress, abi: rigSaleABI, functionName: "claimFreeByFidSig",
        args: [ BigInt(sigData.fid), sigData.to, sigData.inviter, BigInt(sigData.deadline), sigData.v, sigData.r, sigData.s ],
      });
      setTxHash(hash);
      setMessage(`Transaction submitted! Waiting for confirmation...`);

      await fetch("/api/referral", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "mark-valid", invitee_fid: fidStr, invitee_wallet: address }),
      });

    } catch (e: any) {
      setMessage(e?.shortMessage || e?.message || "An error occurred during claim.");
      console.error(e);
    }
  };

  // Fungsi-fungsi lain tidak diubah
  const handleBuy = async (id: number, price?: bigint) => {
    setMessage('');
    setTxHash(undefined);
    try {
        if (!address) throw new Error("Please connect wallet first.");
        if (typeof price === 'undefined') throw new Error("Price is not available yet.");
        setMessage("Please confirm transaction in your wallet...");
        const hash = await writeContractAsync({
            address: rigSaleAddress, abi: rigSaleABI, functionName: 'buy', args: [id], value: price,
        });
        setTxHash(hash);
        setMessage(`Transaction submitted! Waiting for confirmation...`);
    } catch(e: any) {
        setMessage(e?.shortMessage || e?.message || "Transaction failed.");
    }
  };

  const handleBuyBasic = () => handleBuy(0, basicPrice);
  const handleBuyPro = () => handleBuy(1, proPrice);
  const handleBuySupreme = () => handleBuy(2, supremePrice);

  // Fungsi baru untuk klaim reward dari referral
  const handleClaimReferralReward = async () => {
    setMessage("");
    setTxHash(undefined);
    try {
        if (!address) throw new Error("Please connect your wallet first.");
        if (availableClaims <= 0) throw new Error("You have no rewards to claim.");
        
        setMessage("Please confirm reward claim in your wallet...");
        const hash = await writeContractAsync({
            address: rigSaleAddress, abi: rigSaleABI, functionName: "claimReferralRewards", args: [availableClaims],
        });
        setTxHash(hash);
        setMessage(`Claim transaction submitted! Waiting for confirmation...`);

        await fetch("/api/referral", {
            method: "POST", headers: { "content-type": "application/json" },
            body: JSON.stringify({ inviter: address, inc: availableClaims }),
        });

    } catch (e: any) {
        setMessage(e?.shortMessage || e?.message || "Reward claim failed.");
        console.error(e);
    }
  }

  // === Desain & JSX yang ada dipertahankan sepenuhnya ===
  return (
    <div className="p-4 space-y-4">
      <div className="card-header text-center">
        <h1 className="text-xl font-bold">RIG MARKET</h1>
        <p className="text-sm text-neutral-400">Buy, sell, or claim your mining rig.</p>
      </div>
      
      {message && (
        <div className={`p-3 rounded-md text-center text-sm ${isConfirmed ? 'bg-green-500/20 text-green-300' : 'bg-blue-500/20 text-blue-300'}`}>
          <p>{message}</p>
          {txHash && (
            <a href={`https://sepolia.basescan.org/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="underline mt-1 inline-block">
              View on Basescan
            </a>
          )}
        </div>
      )}

      <div className="card bg-purple-800/20 border border-purple-600 rounded-lg p-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="font-bold text-lg">Referral Rewards</h2>
            <p className="text-sm text-neutral-300">You have {availableClaims > 0 ? availableClaims : 0} reward claims available.</p>
          </div>
          <button 
            onClick={handleClaimReferralReward}
            disabled={!address || availableClaims <= 0 || isConfirming}
            className="btn bg-purple-600 hover:bg-purple-500 disabled:bg-neutral-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-md transition-colors"
          >
            {isConfirming ? 'Pending...' : 'Claim'}
          </button>
        </div>
      </div>

      <div className="card bg-neutral-800/50 rounded-lg p-4">
        <div className="flex items-center space-x-4">
          <img src="/img/basic.png" alt="Basic Rig" className="w-20 h-20" />
          <div className="flex-1">
            <h2 className="font-bold text-lg">Basic Rig (Free)</h2>
            <p className="text-sm text-neutral-400">Your first rig is on us! Available for every Farcaster user.</p>
            <p className={`text-xs mt-1 ${freeOpen ? 'text-green-400' : 'text-red-400'}`}>
              Status: {freeOpen ? 'Open' : 'Closed'}
            </p>
          </div>
        </div>
        <button 
          onClick={handleClaimBasicFree}
          disabled={!address || !freeOpen || !!freeMinted || isConfirming}
          className="btn w-full mt-4 bg-green-600 hover:bg-green-500 disabled:bg-neutral-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-md transition-colors"
        >
          {isConfirming ? 'Pending...' : (freeMinted ? 'Already Claimed' : 'Claim Free Rig')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card bg-neutral-800/50 rounded-lg p-4">
              <img src="/img/basic.png" className="w-full" />
              <div className="font-bold mt-2">Basic Rig</div>
              <div className="text-sm text-neutral-400">{Number(basicSupply||0)} minted</div>
              <button onClick={handleBuyBasic} disabled={!address || isConfirming} className="btn w-full mt-4 bg-blue-500 text-white font-bold py-2 px-4 rounded-md">
                  {isConfirming ? 'Pending...' : `Buy (${basicPrice ? formatEther(basicPrice) : '...'} ETH)`}
              </button>
          </div>
          <div className="card bg-neutral-800/50 rounded-lg p-4">
              <img src="/img/pro.png" className="w-full" />
              <div className="font-bold mt-2">Pro Rig</div>
              <div className="text-sm text-neutral-400">{Number(proSupply||0)} minted</div>
              <button onClick={handleBuyPro} disabled={!address || isConfirming} className="btn w-full mt-4 bg-blue-500 text-white font-bold py-2 px-4 rounded-md">
                  {isConfirming ? 'Pending...' : `Buy (${proPrice ? formatEther(proPrice) : '...'} ETH)`}
              </button>
          </div>
          <div className="card bg-neutral-800/50 rounded-lg p-4">
              <img src="/img/supreme.png" className="w-full" />
              <div className="font-bold mt-2">Supreme Rig</div>
              <div className="text-sm text-neutral-400">{Number(supremeSupply||0)} minted</div>
              <button onClick={handleBuySupreme} disabled={!address || isConfirming} className="btn w-full mt-4 bg-blue-500 text-white font-bold py-2 px-4 rounded-md">
                  {isConfirming ? 'Pending...' : `Buy (${supremePrice ? formatEther(supremePrice) : '...'} ETH)`}
              </button>
          </div>
      </div>
    </div>
  );
};

export default Market;


