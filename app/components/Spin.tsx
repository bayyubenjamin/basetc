// app/components/Spin.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type { FC } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  usePublicClient,
} from "wagmi";
import { base } from "viem/chains";
import { formatEther, parseEventLogs, type Hex } from "viem";
import {
  spinVaultAddress,
  spinVaultABI,
  baseTcAddress,
  baseTcABI,
} from "../lib/web3Config";
import { useFarcaster } from "../context/FarcasterProvider";

/* ====== Spinning number component (tetap) ====== */
const SpinningNumbers: FC = () => {
  const [displayValue, setDisplayValue] = useState("0.000000");

  useEffect(() => {
    const updateNumber = () => {
      const randomValue = Math.random() * 5;
      setDisplayValue(randomValue.toFixed(6));
    };
    const intervalId = setInterval(updateNumber, 50);
    return () => clearInterval(intervalId);
  }, []);

  return <>{displayValue}</>;
};

const Spin: FC = () => {
  const { address, isConnected } = useAccount();
  const { user: fcUser } = useFarcaster();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  // State UI
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [finalResult, setFinalResult] = useState<string | null>(null);

  // ---------- Reads On-chain ----------
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
  const { data: vaultBalance, refetch: refetchVaultBalance } = useReadContract({
    address: baseTcAddress,
    abi: baseTcABI as any,
    functionName: "balanceOf",
    args: [spinVaultAddress],
  });

  useEffect(() => {
    const t = setInterval(() => {
      refetchVaultBalance();
    }, 15000);
    return () => clearInterval(t);
  }, [refetchVaultBalance]);

  const canClaim = useMemo(
    () => !loading && isConnected && address && claimed === false,
    [loading, isConnected, address, claimed]
  );
  const poolBalanceStr = useMemo(
    () => (vaultBalance !== undefined ? Number(formatEther(vaultBalance as bigint)).toFixed(4) : "—"),
    [vaultBalance]
  );

  // [UPDATE] Helper Haptic Feedback
  const triggerHaptic = (type: "light" | "success" | "error") => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      if (type === "light") navigator.vibrate(50); // Getar pendek (klik)
      if (type === "success") navigator.vibrate([100, 50, 100]); // Getar panjang (menang)
      if (type === "error") navigator.vibrate([50, 50, 50]); // Getar putus-putus (error)
    }
  };

  // ---------- Action ----------
  const handleSpin = async () => {
    if (!canClaim || !address || !fcUser?.fid) {
      triggerHaptic("error");
      setStatus("Cannot spin now. Check connection or tickets.");
      return;
    }

    triggerHaptic("light");
    setLoading(true);
    setIsSpinning(true);
    setFinalResult(null);
    setStatus("Preparing your spin...");

    try {
      const nonceHook = (nonceValue as bigint | undefined) ?? 0n;
      const ref = await refetchNonces();
      const currentNonce = (ref?.data as bigint | undefined) ?? nonceHook;
      if (currentNonce === undefined) throw new Error("Could not fetch a valid nonce.");

      setStatus("Requesting signature…");
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
      if (!sigRes.ok || !sigData?.signature)
        throw new Error(sigData?.error || "Failed to get signature.");

      setStatus("Waiting for your confirmation...");
      const txHash = await writeContractAsync({
        address: spinVaultAddress,
        abi: spinVaultABI as any,
        functionName: "claimWithSig",
        args: [address, currentNonce, deadline, sigData.signature],
        account: address,
        chain: base,
      });

      setStatus("Processing transaction on-chain…");
      const receipt = await publicClient!.waitForTransactionReceipt({ hash: txHash });

      let wonStr: string | null = null;
      try {
        const events =
          (parseEventLogs({
            abi: spinVaultABI as any,
            logs: receipt.logs as any,
            eventName: "ClaimedSpin",
          }) || []) as any[];
        const amt: bigint | undefined = events?.[0]?.args?.amount;
        if (typeof amt === "bigint") {
          wonStr = formatEther(amt);
        }
      } catch (e) {
        console.error("Error parsing spin event:", e);
        wonStr = "a prize";
      }

      setIsSpinning(false);
      setFinalResult(wonStr);
      setStatus(`Spin successful!`);

      triggerHaptic("success"); // Trigger haptic kemenangan
      await Promise.all([refetchClaimed(), refetchNonces(), refetchVaultBalance()]);
    } catch (e: any) {
      triggerHaptic("error");
      setStatus(`Error: ${e?.shortMessage || e?.message || "Unknown error"}`);
      setIsSpinning(false);
    } finally {
      setLoading(false);
    }
  };

  /* ====== UI ====== */
  return (
    <div className="fin-card fin-card-trans fin-card-pad neu text-center">
      <h2 className="text-lg font-semibold">Free Spin (every 8 hours)</h2>
      <p className="text-sm text-neutral-400">
        Try your luck to win $BaseTC. Each spin gives you rewards based on your rigs.
      </p>

      {/* Pool panel (pressed) */}
      <div className="mx-auto max-w-md mt-4 neu-inner rounded-xl px-4 py-3 text-left">
        <div className="text-xs uppercase tracking-wide text-neutral-400">Spin Pool (real-time)</div>
        <div className="mt-1 text-2xl font-semibold">
          {poolBalanceStr} <span className="text-base text-neutral-400">$BaseTC</span>
        </div>
      </div>

      {/* Spinner / Result / CTA */}
      <div className="py-4 min-h-[120px] flex flex-col justify-center items-center">
        {isSpinning ? (
          <div className="text-4xl font-bold text-yellow-400">
             {/* Animasi pulse saat berputar */}
             <div className="animate-pulse">
                <SpinningNumbers />
             </div>
          </div>
        ) : finalResult ? (
          <div className="text-2xl font-bold text-yellow-400 animate-bounce">
            You won {finalResult} $BaseTC!
          </div>
        ) : (
          <button
            onClick={handleSpin}
            disabled={!canClaim}
            // Tambahkan efek tekan (active:scale) dan shadow
            className={`px-8 py-4 rounded-full fin-btn neu-btn text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-100 active:scale-95 ${
              !canClaim ? "" : "hover:translate-y-[-2px] shadow-lg"
            }`}
          >
            {loading ? "Processing…" : canClaim ? "Spin Now!" : "No spins available"}
          </button>
        )}
      </div>

      {status && <p className="text-xs text-neutral-400 pt-2">{status}</p>}

      <div className="mt-6 text-xs text-neutral-400 space-y-1">
        <p>• Spins increase your leaderboard points.</p>
        <p>• Spin pool is funded from 10% of leftover rewards each epoch.</p>
      </div>
    </div>
  );
};

export default Spin;
