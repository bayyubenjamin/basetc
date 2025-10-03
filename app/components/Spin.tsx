// app/components/Spin.tsx
"use client";

import { useState, useMemo } from "react";
import type { FC } from "react";
import { useAccount, useReadContract, useWriteContract, usePublicClient } from "wagmi";
import { baseSepolia } from "viem/chains";
import { formatEther } from "viem";
import { spinVaultAddress, spinVaultABI } from "../lib/web3Config";
import { useFarcaster } from "../context/FarcasterProvider";

const Spin: FC = () => {
  const { address } = useAccount();
  const { user: fcUser } = useFarcaster();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [spinResult, setSpinResult] = useState<string | null>(null);

  // --- Contract Reads ---
  const { data: epoch, refetch: refetchEpoch } = useReadContract({
    address: spinVaultAddress,
    abi: spinVaultABI as any,
    functionName: "epochNow",
    // Hook ini tidak bergantung pada pengguna, jadi bisa langsung jalan
  });

  const { data: claimed, refetch: refetchClaimed } = useReadContract({
    address: spinVaultAddress,
    abi: spinVaultABI as any,
    functionName: "claimed",
    args: epoch !== undefined && address ? [epoch, address] : undefined,
    query: { 
      // Hanya aktifkan jika 'address' dan 'epoch' sudah ada nilainya
      enabled: !!address && epoch !== undefined 
    },
  });

   const { data: nonces, refetch: refetchNonces } = useReadContract({
    address: spinVaultAddress,
    abi: spinVaultABI as any,
    functionName: "nonces",
    args: address ? [address] : undefined,
    query: { 
      // Hanya aktifkan jika 'address' sudah ada
      enabled: !!address 
    },
  });

  const canClaim = useMemo(() => address && !claimed, [address, claimed]);

  // --- Action ---
  const handleSpin = async () => {
    if (!address || !canClaim || !fcUser?.fid) {
        setStatus("Connect wallet and ensure FID is available.");
        return;
    };
    setLoading(true);
    setStatus("Preparing your daily spin...");
    setSpinResult(null);

    try {
        // Panggil refetch secara eksplisit untuk mendapatkan nilai nonce terbaru
        const nonceResult = await refetchNonces();
        const nonce = nonceResult.data;

        // Validasi bahwa nonce berhasil didapatkan sebelum lanjut
        if (nonce === undefined || nonce === null) {
            throw new Error("Could not fetch a valid nonce. Please try again.");
        }

        const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 jam

        setStatus("Requesting signature from backend...");
        const sigRes = await fetch("/api/sign-event-action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                vault: "spin",
                action: "claim",
                user: address,
                fid: fcUser.fid,
                nonce: String(nonce),
                deadline: String(deadline),
            }),
        });

        const sigData = await sigRes.json();
        if (!sigRes.ok) throw new Error(sigData.error || "Failed to get signature.");

        setStatus("Awaiting transaction confirmation...");
        const txHash = await writeContractAsync({
            address: spinVaultAddress,
            abi: spinVaultABI as any,
            functionName: "claimWithSig",
            args: [address, nonce, deadline, sigData.signature],
            account: address,
            chain: baseSepolia,
        });

        const receipt = await publicClient?.waitForTransactionReceipt({ hash: txHash });

        // Temukan event untuk menampilkan hasil spin
        const claimEvent = receipt?.logs.find(log => log.address.toLowerCase() === spinVaultAddress.toLowerCase());
        if (claimEvent) {
            // Ambil jumlah reward dari data event
            const amountWon = BigInt(claimEvent.data); 
            setSpinResult(Number(formatEther(amountWon)).toFixed(4));
        }
        
        setStatus("Spin successful!");
        // Refresh semua data yang relevan setelah berhasil
        await Promise.all([refetchClaimed(), refetchEpoch(), refetchNonces()]);

    } catch (e: any) {
        setStatus(e?.shortMessage || e?.message || "An error occurred.");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg bg-neutral-900/50 p-4 border border-neutral-700 text-center">
        <h2 className="text-lg font-semibold">Daily Spin</h2>
        <p className="text-sm text-neutral-400">
            Spin once per epoch to win $BaseTC rewards based on your highest rig tier.
        </p>
        
        <div className="py-8">
            <button 
                onClick={handleSpin} 
                disabled={loading || !canClaim}
                className="px-8 py-4 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-bold text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 transition-transform"
            >
                {loading ? "Spinning..." : (canClaim ? "Spin Now!" : "Already Claimed for this Epoch")}
            </button>
        </div>

        {spinResult && (
            <div className="text-2xl font-bold text-yellow-400 animate-pulse">
                You won {spinResult} $BaseTC!
            </div>
        )}

        {status && <p className="text-xs text-neutral-400 pt-2">{status}</p>}
    </div>
  );
};

export default Spin;
