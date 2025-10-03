"use client";

import { useState, useMemo } from "react";
import type { FC } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  usePublicClient,
} from "wagmi";
import { baseSepolia } from "viem/chains";
import { formatEther, decodeEventLog } from "viem";
import { spinVaultAddress, spinVaultABI } from "../lib/web3Config";
import { useFarcaster } from "../context/FarcasterProvider";

const Spin: FC = () => {
  const { address, isConnected } = useAccount();
  const { user: fcUser } = useFarcaster();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [spinResult, setSpinResult] = useState<string | null>(null);

  // --- Contract Reads ---
  const { data: epoch } = useReadContract({
    address: spinVaultAddress,
    abi: spinVaultABI as any,
    functionName: "epochNow",
    query: { enabled: true },
  });

  const { data: claimed, refetch: refetchClaimed } = useReadContract({
    address: spinVaultAddress,
    abi: spinVaultABI as any,
    functionName: "claimed",
    // jalankan hanya kalau epoch & address tersedia
    args:
      epoch !== undefined && address
        ? [epoch as bigint, address as `0x${string}`]
        : undefined,
    query: { enabled: Boolean(address && epoch !== undefined) },
  });

  const { data: nonceValue, refetch: refetchNonces } = useReadContract({
    address: spinVaultAddress,
    abi: spinVaultABI as any,
    functionName: "nonces",
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: Boolean(address) },
  });

  const canClaim = useMemo(() => {
    // boleh claim kalau: connected, ada address, sudah tahu claimed === false
    if (!isConnected || !address) return false;
    if (claimed === undefined) return false;
    return claimed === false;
  }, [isConnected, address, claimed]);

  // --- Action ---
  const handleSpin = async () => {
    if (!isConnected || !address) {
      setStatus("Connect wallet terlebih dulu.");
      return;
    }
    if (!fcUser?.fid) {
      setStatus("FID Farcaster tidak ditemukan.");
      return;
    }
    if (!canClaim) {
      setStatus("Sudah klaim untuk epoch ini, atau data belum siap.");
      return;
    }

    setLoading(true);
    setStatus("1/4: Mengambil nonce terbaru…");
    setSpinResult(null);

    try {
      // Ambil nonce dari hook; lalu (opsional) override dengan hasil refetch agar fresh
      const nonceHook = (nonceValue as bigint | undefined) ?? 0n;
      const ref = await refetchNonces(); // wagmi refetch() => { data }
      const currentNonce =
        (ref?.data as bigint | undefined) ?? nonceHook;

      if (currentNonce === undefined || currentNonce === null) {
        throw new Error("Gagal mengambil nonce. Coba lagi.");
      }

      setStatus("2/4: Meminta signature dari backend…");
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 jam

      const sigRes = await fetch("/api/sign-event-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vault: "spin",
          action: "claim",
          user: address,
          fid: fcUser.fid,
          // kirim sebagai string supaya aman di JSON
          nonce: currentNonce.toString(),
          deadline: deadline.toString(),
        }),
      });

      const sigData = await sigRes.json();
      if (!sigRes.ok) {
        throw new Error(sigData?.error || "Gagal mendapatkan signature.");
      }
      if (!sigData?.signature) {
        throw new Error("Signature kosong dari backend.");
      }

      setStatus("3/4: Mengirim transaksi…");
      const txHash = await writeContractAsync({
        address: spinVaultAddress,
        abi: spinVaultABI as any,
        functionName: "claimWithSig",
        // kirim ke kontrak pakai bigint
        args: [address as `0x${string}`, currentNonce, deadline, sigData.signature as `0x${string}`],
        account: address as `0x${string}`,
        chain: baseSepolia,
      });

      setStatus("4/4: Menunggu konfirmasi…");
      const receipt = await publicClient!.waitForTransactionReceipt({
        hash: txHash,
      });

      // Decode event untuk ambil amount
      let won: bigint | null = null;
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== spinVaultAddress.toLowerCase()) continue;
        try {
          const decoded = decodeEventLog({
            abi: spinVaultABI as any,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === "ClaimedSpin") {
            // event ClaimedSpin(address user, uint256 epoch, uint256 amount, uint8 tier)
            const args: any = decoded.args;
            won = args?.amount as bigint;
            break;
          }
        } catch {
          // skip log yang bukan event kita
        }
      }

      if (won !== null) {
        setSpinResult(Number(formatEther(won)).toFixed(4));
      } else {
        setSpinResult(null);
      }

      setStatus("Spin sukses!");
      await Promise.all([refetchClaimed(), refetchNonces()]);

    } catch (e: any) {
      setStatus(`Error: ${e?.shortMessage || e?.message || "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg bg-neutral-900/50 p-4 border border-neutral-700 text-center">
      <h2 className="text-lg font-semibold">Daily Spin</h2>
      <p className="text-sm text-neutral-400">
        Spin sekali per epoch untuk hadiah $BaseTC (tier berdasar Rig tertinggi).
      </p>

      <div className="py-8">
        <button
          onClick={handleSpin}
          disabled={loading || !canClaim}
          className="px-8 py-4 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-bold text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 transition-transform"
        >
          {loading ? "Spinning..." : (canClaim ? "Spin Now!" : "Already Claimed / Not Ready")}
        </button>
      </div>

      {spinResult && (
        <div className="text-2xl font-bold text-yellow-400 animate-pulse">
          You won {spinResult} $BaseTC!
        </div>
      )}

      {status && (
        <p className="text-xs text-neutral-400 pt-2 break-all">{status}</p>
      )}
    </div>
  );
};

export default Spin;

