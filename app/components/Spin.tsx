"use client";

import { useState, useMemo } from "react";
import type { FC } from "react";
import { useAccount, useReadContract, useWriteContract, usePublicClient } from "wagmi";
import { baseSepolia } from "viem/chains";
import { formatEther, parseEventLogs } from "viem";
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

  // --- Reads ---
  const { data: epoch } = useReadContract({
    address: spinVaultAddress,
    abi: spinVaultABI as any,
    functionName: "epochNow",
  });

  const { data: claimed, refetch: refetchClaimed } = useReadContract({
    address: spinVaultAddress,
    abi: spinVaultABI as any,
    functionName: "claimed",
    args: epoch !== undefined && address ? [epoch as bigint, address as `0x${string}`] : undefined,
    query: { enabled: Boolean(address && epoch !== undefined) },
  });

  const { data: nonceValue, refetch: refetchNonces } = useReadContract({
    address: spinVaultAddress,
    abi: spinVaultABI as any,
    functionName: "nonces",
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: Boolean(address) },
  });

  const canClaim = useMemo(
    () => Boolean(isConnected && address && claimed === false),
    [isConnected, address, claimed]
  );

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
      setStatus("Sudah klaim epoch ini / data belum siap.");
      return;
    }

    setLoading(true);
    setStatus("1/4: Fetching nonce…");
    setSpinResult(null);

    try {
      // Ambil nonce dari hook, lalu override dengan refetch biar fresh
      const nonceHook = (nonceValue as bigint | undefined) ?? 0n;
      const ref = await refetchNonces();
      const currentNonce = (ref?.data as bigint | undefined) ?? nonceHook;
      if (currentNonce === undefined || currentNonce === null) {
        throw new Error("Could not fetch a valid nonce. Try again.");
      }

      // Minta signature dari backend
      setStatus("2/4: Requesting signature…");
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const sigRes = await fetch("/api/sign-event-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vault: "spin",
          action: "claim",
          user: address,
          fid: fcUser.fid,
          nonce: currentNonce.toString(),
          deadline: deadline.toString(),
        }),
      });
      const sigData = await sigRes.json();
      if (!sigRes.ok || !sigData?.signature) {
        throw new Error(sigData?.error || "Failed to get signature");
      }

      // Kirim tx
      setStatus("3/4: Sending transaction…");
      const hash = await writeContractAsync({
        address: spinVaultAddress,
        abi: spinVaultABI as any,
        functionName: "claimWithSig",
        args: [address as `0x${string}`, currentNonce, deadline, sigData.signature as `0x${string}`],
        account: address as `0x${string}`,
        chain: baseSepolia,
      });

      // Tunggu receipt & parse event
      setStatus("4/4: Waiting for confirmation…");
      const receipt = await publicClient!.waitForTransactionReceipt({ hash });

      let won: string | null = null;
      try {
        const events = parseEventLogs({
          abi: spinVaultABI as any,
          logs: receipt.logs,
          eventName: "ClaimedSpin",
        });
        const amt = (events?.[0]?.args as any)?.amount as bigint | undefined;
        if (amt !== undefined) won = Number(formatEther(amt)).toFixed(4);
      } catch {
        // kalau parsing gagal, tetap anggap sukses tanpa angka
      }
      setSpinResult(won);
      setStatus("Spin successful!");

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
        Spin once per epoch to win $BaseTC rewards based on your highest rig tier.
      </p>

      <div className="py-8">
        <button
          onClick={handleSpin}
          disabled={loading || !canClaim}
          className="px-8 py-4 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-white font-bold text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 transition-transform"
        >
          {loading ? "Spinning..." : canClaim ? "Spin Now!" : "Already Claimed for this Epoch"}
        </button>
      </div>

      {spinResult && (
        <div className="text-2xl font-bold text-yellow-400 animate-pulse">
          You won {spinResult} $BaseTC!
        </div>
      )}

      {status && <p className="text-xs text-neutral-400 pt-2 break-all">{status}</p>}
    </div>
  );
};

export default Spin;

