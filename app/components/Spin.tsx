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
import { formatEther, parseEventLogs } from "viem";
import {
  spinVaultAddress,
  spinVaultABI,
  baseTcAddress,
  baseTcABI,
} from "../lib/web3Config";
import { useFarcaster } from "../context/FarcasterProvider";
// PERBAIKAN DI SINI: Gunakan kurung kurawal { sdk }
import { sdk } from "@farcaster/miniapp-sdk";

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
  
  // State untuk alur Cast & Claim
  const [waitingForCast, setWaitingForCast] = useState(false);
  const [pointsClaimed, setPointsClaimed] = useState(false);

  // ---------- Reads On-chain ----------
  const { data: epoch } = useReadContract({
    address: spinVaultAddress,
    abi: spinVaultABI as any,
    functionName: "epochNow",
  });
  
  // Refetch claimed status
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
    () => !loading && isConnected && address && claimed === false && !waitingForCast,
    [loading, isConnected, address, claimed, waitingForCast]
  );
  
  const poolBalanceStr = useMemo(
    () => (vaultBalance !== undefined ? Number(formatEther(vaultBalance as bigint)).toFixed(4) : "—"),
    [vaultBalance]
  );

  // ---------- Action: 1. Spin Transaction ----------
  const handleSpin = async () => {
    if (!canClaim || !address || !fcUser?.fid) {
      setStatus("Cannot spin now. Check connection or tickets.");
      return;
    }

    setLoading(true);
    setIsSpinning(true);
    setFinalResult(null);
    setPointsClaimed(false);
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
      setStatus("Spin Successful! Cast result to claim points.");
      
      setWaitingForCast(true);

      await Promise.all([refetchClaimed(), refetchNonces(), refetchVaultBalance()]);
    } catch (e: any) {
      setStatus(`Error: ${e?.shortMessage || e?.message || "Unknown error"}`);
      setIsSpinning(false);
      setWaitingForCast(false); 
    } finally {
      setLoading(false);
    }
  };

  // ---------- Action: 2. Cast & Claim Points ----------
  const handleCastAndClaim = async () => {
    if (!fcUser?.fid || !finalResult) return;

    setLoading(true);
    setStatus("Opening Farcaster...");

    try {
      const text = `I just won ${finalResult} $BaseTC on @basetc! 🎰\n\nSpin daily to win rewards and climb the leaderboard.`;
      
      // === UPDATE EMBED URL ===
      const embed = "https://basetc.xyz"; 
      const castUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(embed)}`;

      // 1. Buka Composer Warpcast menggunakan sdk.actions
      if (sdk && sdk.actions) {
        // Gunakan openUrl karena composeCast mungkin tidak tersedia di semua versi atau context
        // Atau gunakan sdk.actions.openUrl(castUrl) jika composeCast bermasalah
        await sdk.actions.openUrl(castUrl);
      } else {
         // Fallback jika SDK gagal load
         window.open(castUrl, '_blank');
      }

      // 2. Claim Points (Optimistic Update)
      setStatus("Claiming points...");
      
      const res = await fetch("/api/points/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fid: fcUser.fid }),
      });

      if (!res.ok) throw new Error("Failed to add points");

      setPointsClaimed(true);
      setWaitingForCast(false); 
      setStatus("Points claimed successfully!");

    } catch (e: any) {
      setStatus("Error claiming points: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  /* ====== UI ====== */
  return (
    <div className="fin-card fin-card-trans fin-card-pad neu text-center">
      <h2 className="text-lg font-semibold">Free Spin (every 8 hours)</h2>
      <p className="text-sm text-neutral-400">
        Try your luck to win $BaseTC. Spin & Cast to earn leaderboard points.
      </p>

      {/* Pool panel */}
      <div className="mx-auto max-w-md mt-4 neu-inner rounded-xl px-4 py-3 text-left">
        <div className="text-xs uppercase tracking-wide text-neutral-400">Spin Pool (real-time)</div>
        <div className="mt-1 text-2xl font-semibold">
          {poolBalanceStr} <span className="text-base text-neutral-400">$BaseTC</span>
        </div>
      </div>

      {/* Spinner / Result / CTA */}
      <div className="py-4 min-h-[120px] flex flex-col justify-center items-center gap-3">
        {isSpinning ? (
          <div className="text-4xl font-bold text-yellow-400">
            <SpinningNumbers />
          </div>
        ) : waitingForCast && finalResult ? (
          // STATE: Menunggu User Cast
          <div className="animate-in fade-in zoom-in duration-300 w-full">
             <div className="text-2xl font-bold text-yellow-400 mb-2">You won {finalResult} $BaseTC!</div>
             <p className="text-xs text-neutral-300 mb-4">Cast your win to claim leaderboard points.</p>
             <button
              onClick={handleCastAndClaim}
              disabled={loading}
              className="w-full sm:w-auto px-6 py-3 rounded-full bg-purple-600 text-white font-bold shadow-lg hover:bg-purple-700 active:scale-95 transition-all flex items-center justify-center gap-2 mx-auto"
            >
              {loading ? (
                <span>Verifying...</span>
              ) : (
                <>
                  <span>✨ Cast & Claim Points</span>
                </>
              )}
            </button>
          </div>
        ) : pointsClaimed ? (
          // STATE: Selesai
          <div className="text-xl font-bold text-green-400 animate-in fade-in slide-in-from-bottom-2">
            🎉 Points Added! <br/>
            <span className="text-sm text-neutral-400 font-normal">See you next epoch.</span>
          </div>
        ) : (
          // STATE: Default (Belum Spin)
          <button
            onClick={handleSpin}
            disabled={!canClaim}
            className={`px-8 py-4 rounded-full fin-btn neu-btn text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-transform active:scale-[0.98] ${
              !canClaim ? "" : "hover:translate-y-[-1px]"
            }`}
          >
            {loading ? "Processing…" : canClaim ? "Spin Now!" : "No spins available"}
          </button>
        )}
      </div>

      {status && <p className="text-xs text-neutral-400 pt-2 animate-pulse">{status}</p>}

      <div className="mt-6 text-xs text-neutral-400 space-y-1">
        <p>• Spins increase your leaderboard points (requires Cast).</p>
        <p>• Spin pool is funded from 10% of leftover rewards each epoch.</p>
      </div>
    </div>
  );
};

export default Spin;
