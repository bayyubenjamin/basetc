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
import { sdk } from "@farcaster/miniapp-sdk";
// Imports UI Icons
import { 
  Trophy, Sparkles, Loader2, RefreshCw, 
  Share2, AlertCircle, CheckCircle2, Ticket 
} from "lucide-react";

/* ====== Spinning Number Component (Enhanced) ====== */
const SpinningNumbers: FC = () => {
  const [displayValue, setDisplayValue] = useState("0.000000");

  useEffect(() => {
    const updateNumber = () => {
      // Efek visual angka acak yang lebih dinamis
      const randomValue = Math.random() * 10; 
      setDisplayValue(randomValue.toFixed(6));
    };
    const intervalId = setInterval(updateNumber, 40); // Lebih cepat sedikit agar terlihat smooth
    return () => clearInterval(intervalId);
  }, []);

  return (
    <span className="tabular-nums tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 animate-pulse">
      {displayValue}
    </span>
  );
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
    setStatus("Preparing system...");

    try {
      const nonceHook = (nonceValue as bigint | undefined) ?? 0n;
      const ref = await refetchNonces();
      const currentNonce = (ref?.data as bigint | undefined) ?? nonceHook;
      if (currentNonce === undefined) throw new Error("Could not fetch a valid nonce.");

      setStatus("Requesting security signature...");
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

      setStatus("Waiting for wallet confirmation...");
      const txHash = await writeContractAsync({
        address: spinVaultAddress,
        abi: spinVaultABI as any,
        functionName: "claimWithSig",
        args: [address, currentNonce, deadline, sigData.signature],
        account: address,
        chain: base,
      });

      setStatus("Verifying on blockchain...");
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
      setStatus("Spin Successful!");
      
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
    setStatus("Opening Farcaster composer...");

    try {
      const text = `I just won ${finalResult} BaseTC on @basetc! 🎰\n\nSpin daily to win rewards and climb the leaderboard.`;
      
      const embed = "https://basetc.xyz"; 
      const castUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(embed)}`;

      if (sdk && sdk.actions) {
        await sdk.actions.openUrl(castUrl);
      } else {
         window.open(castUrl, '_blank');
      }

      setStatus("Finalizing points claim...");
      
      const res = await fetch("/api/points/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fid: fcUser.fid }),
      });

      if (!res.ok) throw new Error("Failed to add points");

      setPointsClaimed(true);
      setWaitingForCast(false); 
      setStatus("All done! Points secured.");

    } catch (e: any) {
      setStatus("Error claiming points: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  /* ====== UI RENDER ====== */
  return (
    <div className="relative w-full max-w-md mx-auto bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden transition-all duration-300">
      
      {/* HEADER SECTION */}
      <div className="bg-slate-50/80 backdrop-blur-sm p-6 border-b border-slate-100 flex justify-between items-start">
        <div>
           <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 bg-yellow-100 text-yellow-600 rounded-lg">
                <Ticket size={16} strokeWidth={2.5}/>
              </div>
              <h2 className="text-lg font-black text-slate-800 tracking-tight">DAILY SPIN</h2>
           </div>
           <p className="text-xs text-slate-500 font-medium">Reset every 8 hours. Try your luck!</p>
        </div>
        
        {/* POOL BADGE */}
        <div className="text-right">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Prize Pool</div>
            <div className="font-mono font-bold text-slate-800 text-lg leading-none">
                 {poolBalanceStr}
            </div>
            <span className="text-[10px] text-blue-500 font-bold">$TC</span>
        </div>
      </div>

      {/* GAME AREA */}
      <div className="p-8 flex flex-col items-center justify-center min-h-[280px] relative">
          
          {/* Background Decor */}
          <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] opacity-25 pointer-events-none" />

          {/* MAIN DISPLAY */}
          <div className="z-10 w-full text-center">
              
              {/* 1. STATE: SPINNING */}
              {isSpinning && (
                <div className="animate-in fade-in zoom-in duration-500">
                    <div className="w-24 h-24 mx-auto mb-6 relative">
                         <div className="absolute inset-0 rounded-full border-4 border-slate-100"></div>
                         <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 animate-spin"></div>
                         <div className="absolute inset-0 flex items-center justify-center text-blue-500">
                            <RefreshCw size={32} className="animate-spin-reverse" />
                         </div>
                    </div>
                    <div className="text-4xl font-black mb-2 font-mono">
                        <SpinningNumbers />
                    </div>
                    <p className="text-sm text-slate-400 font-medium animate-pulse">Calculating entropy...</p>
                </div>
              )}

              {/* 2. STATE: WAITING FOR CAST (WIN) */}
              {!isSpinning && waitingForCast && finalResult && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                     <div className="w-20 h-20 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-xl ring-4 ring-yellow-100/50">
                        <Trophy size={40} className="text-yellow-500 animate-bounce" />
                     </div>
                     <h3 className="text-2xl font-black text-slate-800 mb-1">YOU WON!</h3>
                     <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-yellow-500 to-orange-500 mb-6">
                        {parseFloat(finalResult).toFixed(4)} <span className="text-lg text-slate-400 font-bold">$TC</span>
                     </div>

                     <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-4">
                        <p className="text-xs text-slate-500 mb-3">Share your win to claim leaderboard points.</p>
                        <button
                            onClick={handleCastAndClaim}
                            disabled={loading}
                            className="w-full py-3.5 rounded-xl bg-slate-900 text-white font-bold text-sm shadow-lg shadow-slate-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2 hover:bg-slate-800"
                        >
                            {loading ? <Loader2 className="animate-spin" size={18}/> : <Share2 size={18}/>}
                            CAST & CLAIM POINTS
                        </button>
                     </div>
                  </div>
              )}

              {/* 3. STATE: COMPLETED */}
              {!isSpinning && pointsClaimed && (
                  <div className="animate-in zoom-in duration-500 py-4">
                     <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 size={32} className="text-emerald-500" />
                     </div>
                     <h3 className="text-xl font-bold text-emerald-600 mb-2">Claim Successful!</h3>
                     <p className="text-sm text-slate-400">Points have been added to your profile.<br/>Come back next epoch.</p>
                  </div>
              )}

              {/* 4. STATE: IDLE / START */}
              {!isSpinning && !waitingForCast && !pointsClaimed && (
                 <div className="animate-in fade-in duration-500">
                    <div className="mb-6">
                        {canClaim ? (
                            <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto border-[6px] border-white shadow-xl ring-1 ring-slate-100 mb-4">
                                <Sparkles size={40} className="text-blue-500" />
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-4 mb-4">
                                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center border-[6px] border-white shadow-inner relative">
                                    {claimed ? (
                                        <div className="relative">
                                            <Trophy size={32} className="text-slate-300" />
                                            <div className="absolute -bottom-1 -right-1 bg-slate-200 rounded-full p-1 border-2 border-white">
                                                <CheckCircle2 size={12} className="text-slate-500" />
                                            </div>
                                        </div>
                                    ) : (
                                        <AlertCircle size={32} className="text-slate-300" />
                                    )}
                                </div>
                                
                                <div className="text-center px-2">
                                    <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider mb-2">
                                        {claimed ? "Limit Reached" : "System Standby"}
                                    </h3>
                                    <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 max-w-[260px] mx-auto">
                                        <p className="text-xs text-slate-500 font-medium leading-relaxed">
                                            {claimed 
                                                ? "Allocated spins based on your Active Rigs. Higher tier Rigs unlock better odds. Refreshing next epoch." 
                                                : "Please connect your wallet to verify your Rigs. Daily spins are exclusive to active Rigs owners."}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    <button
                        onClick={handleSpin}
                        disabled={!canClaim || loading}
                        className={`w-full py-4 rounded-xl font-bold text-sm tracking-wide shadow-xl transition-all flex items-center justify-center gap-2
                            ${canClaim 
                                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-blue-200 active:scale-[0.98]" 
                                : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 shadow-none"
                            }`}
                    >
                         {loading ? (
                             <><Loader2 className="animate-spin" size={18}/> PROCESSING...</>
                         ) : canClaim ? (
                             <>START FREE SPIN <Ticket size={18} /></>
                         ) : (
                             claimed ? "COOLDOWN ACTIVE" : "WALLET DISCONNECTED"
                         )}
                    </button>
                 </div>
              )}
          </div>
      </div>

      {/* FOOTER / STATUS BAR */}
      <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 text-center">
          {status ? (
              <div className="text-[10px] font-mono font-medium text-blue-600 flex items-center justify-center gap-2 animate-pulse">
                  <Loader2 size={10} className="animate-spin" /> {status}
              </div>
          ) : (
              <p className="text-[10px] text-slate-400 font-medium">
                  {claimed ? "Next spin available next epoch" : "Spin requires gas fee (Base Network)"}
              </p>
          )}
      </div>

    </div>
  );
};

export default Spin;
