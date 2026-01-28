"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { formatEther, parseEther } from "viem";
import { base } from "viem/chains";
import { 
  Zap, AlertTriangle, Cpu, Loader2, Play, 
  ShieldCheck, Info, TrendingUp, Wallet, CheckCircle2 
} from "lucide-react";
import confetti from "canvas-confetti";
import { CFG } from "../lib/web3Config";

// --- CONFIGURATION ---
const OVERCLOCK_ADDRESS = CFG.addresses.OVERCLOCK as `0x${string}`;
const BASETC_ADDRESS = CFG.addresses.BASETC as `0x${string}`;
const OVERCLOCK_ABI = CFG.abis.overclock;
const ERC20_ABI = CFG.abis.baseTc;

export default function OverclockGame() {
  const { address } = useAccount();
  const [betInput, setBetInput] = useState("100");
  const [gameState, setGameState] = useState<"IDLE" | "PLAYING" | "CRASHED" | "WON">("IDLE");
  const [loading, setLoading] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // --- CONTRACT READS (Realtime Polling) ---
  const { data: sessionData, refetch: refetchSession } = useReadContract({
    address: OVERCLOCK_ADDRESS,
    abi: OVERCLOCK_ABI,
    functionName: "sessions",
    args: address ? [address] : undefined,
    query: { refetchInterval: 1000 } // Auto refresh every 1s
  });

  const { data: boostChance } = useReadContract({
    address: OVERCLOCK_ADDRESS,
    abi: OVERCLOCK_ABI,
    functionName: "_calculateBoost",
    args: address ? [address] : undefined,
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: BASETC_ADDRESS,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, OVERCLOCK_ADDRESS] : undefined,
    query: { refetchInterval: 3000 }
  });

  const { writeContractAsync: writeTx } = useWriteContract();

  // --- STATE SYNC ---
  useEffect(() => {
    if (sessionData) {
      const [, , active] = sessionData as [bigint, number, boolean];
      if (active) {
        setGameState("PLAYING");
      } else if (gameState === "PLAYING" && !active) {
        // If contract says not active but local says playing, user might have refreshed page after crash/win
        // We set to IDLE unless we just performed an action
        if (!loading) setGameState("IDLE");
      }
    }
  }, [sessionData, gameState, loading]);

  // --- ACTIONS ---
  const handleStart = async () => {
    if (!address) return;
    setLoading(true);
    try {
      const amount = parseEther(betInput);
      
      // Approval Check
      if (!allowance || (allowance as bigint) < amount) {
        setIsApproving(true);
        await writeTx({
          address: BASETC_ADDRESS,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [OVERCLOCK_ADDRESS, parseEther("10000000")],
          chain: base,
          account: address,
        });
        await refetchAllowance();
        setIsApproving(false);
      }

      await writeTx({
        address: OVERCLOCK_ADDRESS,
        abi: OVERCLOCK_ABI,
        functionName: "startGame",
        args: [amount],
        chain: base,
        account: address,
      });
      
      setGameState("PLAYING");
      await refetchSession();
    } catch (e) { console.error("Start Error:", e); setIsApproving(false); }
    setLoading(false);
  };

  const handleOverclock = async () => {
    setLoading(true);
    try {
      await writeTx({
        address: OVERCLOCK_ADDRESS,
        abi: OVERCLOCK_ABI,
        functionName: "overclock",
        args: [],
        chain: base,
        account: address,
      });
      await refetchSession();
    } catch (e) {
      console.error("Overclock Error:", e);
      // Assume crash on error if session becomes inactive
      setGameState("CRASHED");
      setTimeout(() => {
         setGameState("IDLE");
         refetchSession();
      }, 3000);
    }
    setLoading(false);
  };

  const handleCashout = async () => {
    setLoading(true);
    try {
      await writeTx({
        address: OVERCLOCK_ADDRESS,
        abi: OVERCLOCK_ABI,
        functionName: "cashout",
        args: [],
        chain: base,
        account: address,
      });
      setGameState("WON");
      confetti({ 
        particleCount: 150, 
        spread: 70, 
        origin: { y: 0.6 },
        colors: ['#3b82f6', '#10b981', '#fbbf24'] 
      });
      await refetchSession();
      setTimeout(() => setGameState("IDLE"), 4000);
    } catch (e) { console.error("Cashout Error:", e); }
    setLoading(false);
  };

  // --- CALCULATIONS ---
  const currentLevel = sessionData ? Number((sessionData as any)[1]) : 0;
  const betAmountRaw = sessionData ? (sessionData as any)[0] : parseEther(betInput);
  const betAmountEth = formatEther(betAmountRaw as bigint);
  const myBoost = Number(boostChance || 0);

  const LEVEL_DATA = [
    { name: "SAFE MODE", mult: "1.0x", baseRisk: 0, color: "text-slate-500", barColor: "bg-slate-300" },
    { name: "MILD OVERCLOCK", mult: "1.2x", baseRisk: 10, color: "text-blue-600", barColor: "bg-blue-500" }, 
    { name: "HIGH VOLTAGE", mult: "1.8x", baseRisk: 30, color: "text-yellow-600", barColor: "bg-yellow-500" }, 
    { name: "EXTREME LOAD", mult: "3.5x", baseRisk: 50, color: "text-orange-600", barColor: "bg-orange-500" }, 
    { name: "HAZARD ZONE", mult: "8.0x", baseRisk: 70, color: "text-red-600", barColor: "bg-red-600" }, 
  ];

  const safeLevel = Math.min(currentLevel, LEVEL_DATA.length - 1);
  const currentData = LEVEL_DATA[safeLevel];
  const nextData = LEVEL_DATA[safeLevel + 1] || LEVEL_DATA[safeLevel];
  
  const potentialWin = (parseFloat(betAmountEth) * parseFloat(currentData.mult)).toFixed(2);
  const nextRisk = nextData.baseRisk;
  const actualRisk = Math.max(0, nextRisk - myBoost);

  // --- RENDER ---
  return (
    <div className="relative w-full max-w-md mx-auto">
      {/* CARD CONTAINER */}
      <div className="bg-white rounded-3xl shadow-[0_20px_50px_rgba(8,_112,_184,_0.1)] border border-slate-100 overflow-hidden transition-all duration-300">
        
        {/* HEADER */}
        <div className="bg-slate-50/80 backdrop-blur-sm border-b border-slate-200 p-5 flex justify-between items-center">
            <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-2 rounded-xl text-blue-600">
                    <Cpu size={20} />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-slate-800 leading-none">OVERCLOCK</h2>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Simulation Lab</span>
                </div>
            </div>
            <div className="flex gap-2">
                {myBoost > 0 && (
                    <div className="flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg text-[10px] font-bold border border-emerald-200">
                        <ShieldCheck size={12} /> -{myBoost}% RISK
                    </div>
                )}
                <button 
                    onClick={() => setShowInfo(!showInfo)}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                >
                    <Info size={18} />
                </button>
            </div>
        </div>

        {/* INFO MODAL */}
        {showInfo && (
            <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-md p-6 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg text-slate-800">How to Play</h3>
                    <button onClick={() => setShowInfo(false)} className="text-slate-400 hover:text-slate-600">Close</button>
                </div>
                <div className="space-y-4 text-sm text-slate-600">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <strong className="block text-slate-900 mb-1">1. Initialize System</strong>
                        Set your $TC bet amount and start the simulation. The initial multiplier is 1.0x (Refundable).
                    </div>
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                        <strong className="block text-blue-900 mb-1">2. Overclock (Boost)</strong>
                        Click <span className="font-bold">BOOST VOLTAGE</span> to increase the multiplier.
                        <br/>
                        <span className="text-xs text-blue-600 mt-1 block">Warning: Every boost has a chance to explode based on risk level.</span>
                    </div>
                    <div className="p-3 bg-green-50 rounded-xl border border-green-100">
                        <strong className="block text-green-900 mb-1">3. Cash Out</strong>
                        Secure your profits at any time before the system crashes.
                    </div>
                </div>
            </div>
        )}

        {/* GAME STAGE */}
        <div className="p-6 min-h-[340px] flex flex-col items-center justify-center relative bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-opacity-50">
            
            {/* IDLE STATE */}
            {gameState === "IDLE" && (
                <div className="w-full space-y-6 animate-in zoom-in-95 duration-300">
                    <div className="text-center">
                        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-lg">
                            <Play size={32} className="text-blue-500 ml-1" />
                        </div>
                        <h3 className="text-slate-800 font-bold text-xl">Ready to Start?</h3>
                        <p className="text-slate-400 text-sm">Configure your system parameters.</p>
                    </div>

                    <div className="bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
                        <div className="grid grid-cols-3 gap-1 mb-2">
                            {["100", "500", "1000"].map(amt => (
                                <button key={amt} onClick={() => setBetInput(amt)} 
                                    className={`py-2 rounded-xl text-xs font-bold transition-all ${betInput === amt ? "bg-white text-blue-600 shadow-sm border border-slate-200" : "text-slate-400 hover:bg-white/50"}`}>
                                    {amt}
                                </button>
                            ))}
                        </div>
                        <div className="relative">
                            <input 
                                type="number" 
                                value={betInput} 
                                onChange={(e) => setBetInput(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-slate-800 font-mono text-center font-bold text-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">$TC</span>
                        </div>
                    </div>
                    
                    <button 
                        onClick={handleStart} 
                        disabled={loading}
                        className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-sm shadow-lg shadow-slate-200 active:scale-[0.98] transition-all flex justify-center items-center gap-2"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : isApproving ? "APPROVING TOKEN..." : "INITIALIZE SYSTEM"}
                    </button>
                </div>
            )}

            {/* PLAYING STATE */}
            {gameState === "PLAYING" && (
                <div className="w-full flex flex-col h-full justify-between animate-in fade-in duration-300">
                    
                    {/* LEVEL INDICATOR */}
                    <div className="relative mb-6">
                         {/* Progress Track */}
                         <div className="h-3 bg-slate-100 rounded-full w-full overflow-hidden">
                            <div 
                                className={`h-full transition-all duration-500 ease-out ${currentData.barColor}`} 
                                style={{width: `${(currentLevel / 4) * 100}%`}}
                            />
                         </div>
                         {/* Nodes */}
                         <div className="absolute top-1/2 -translate-y-1/2 w-full flex justify-between px-1">
                            {[0, 1, 2, 3, 4].map((lvl) => (
                                <div key={lvl} className={`w-4 h-4 rounded-full border-2 transition-all duration-500
                                    ${currentLevel >= lvl ? "bg-white border-blue-500 scale-125" : "bg-slate-200 border-white"}`} 
                                />
                            ))}
                         </div>
                    </div>

                    {/* MAIN DISPLAY */}
                    <div className="text-center py-4 relative">
                        {/* Background Pulse Effect */}
                        <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/5 to-transparent blur-xl transition-opacity duration-500 ${loading ? 'opacity-100 animate-pulse' : 'opacity-0'}`}></div>
                        
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Current Multiplier</div>
                        <div className={`text-7xl font-black tracking-tighter transition-all duration-300 ${loading ? 'scale-105 blur-[1px]' : 'scale-100'} ${currentData.color}`}>
                            {currentData.mult}
                        </div>
                        <div className={`text-sm font-bold mt-2 ${currentData.color}`}>
                            {currentData.name}
                        </div>
                    </div>

                    {/* STATS GRID */}
                    <div className="grid grid-cols-2 gap-3 mb-6">
                        <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl flex flex-col items-center">
                            <span className="text-[10px] text-slate-400 uppercase font-bold">Potential Profit</span>
                            <div className="flex items-center gap-1 text-emerald-600 font-bold text-lg">
                                <TrendingUp size={16} /> {potentialWin}
                            </div>
                        </div>
                        <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl flex flex-col items-center">
                             <span className="text-[10px] text-slate-400 uppercase font-bold">Next Fail Risk</span>
                            {currentLevel < 4 ? (
                                <div className="flex items-center gap-1 text-red-500 font-bold text-lg">
                                    <AlertTriangle size={16} /> {actualRisk}%
                                </div>
                            ) : (
                                <div className="text-xs font-bold text-slate-400 mt-1">MAX LEVEL</div>
                            )}
                        </div>
                    </div>

                    {/* CONTROLS */}
                    <div className="grid grid-cols-2 gap-3 mt-auto">
                        <button 
                            onClick={handleCashout}
                            disabled={loading}
                            className="py-4 bg-white border-2 border-slate-100 hover:border-emerald-200 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 rounded-xl font-bold text-sm transition-all flex flex-col items-center justify-center gap-1 active:scale-[0.98]"
                        >
                            <Wallet size={18} />
                            SECURE PROFIT
                        </button>

                        <button 
                            onClick={handleOverclock}
                            disabled={loading || currentLevel >= 4}
                            className={`py-4 rounded-xl font-bold text-sm text-white shadow-lg active:scale-[0.98] transition-all flex flex-col items-center justify-center gap-1
                                ${currentLevel >= 4 ? 'bg-slate-300 cursor-not-allowed' : 'bg-gradient-to-br from-blue-600 to-indigo-600 hover:shadow-blue-200'}`}
                        >
                            {loading ? <Loader2 className="animate-spin" size={18}/> : <Zap size={18}/>}
                            {loading ? "BOOSTING..." : "BOOST VOLTAGE"}
                        </button>
                    </div>
                </div>
            )}

            {/* RESULTS STATE */}
            {(gameState === "CRASHED" || gameState === "WON") && (
                <div className="text-center animate-in zoom-in duration-500">
                     <div className="w-24 h-24 mx-auto mb-4 rounded-full flex items-center justify-center bg-white shadow-xl">
                        {gameState === "WON" ? (
                             <CheckCircle2 size={48} className="text-emerald-500" />
                        ) : (
                             <AlertTriangle size={48} className="text-red-500" />
                        )}
                     </div>
                     
                     <h3 className={`text-3xl font-black mb-2 ${gameState === "WON" ? "text-emerald-600" : "text-red-500"}`}>
                        {gameState === "WON" ? "YOU WON!" : "SYSTEM FAILURE"}
                     </h3>
                     
                     <p className="text-slate-500 mb-8 max-w-[200px] mx-auto">
                        {gameState === "WON" 
                            ? "Profits have been securely transferred to your wallet." 
                            : "The rig overheated due to high voltage. Cooling down..."}
                     </p>

                     <div className="flex items-center justify-center gap-2 text-slate-400 text-xs font-mono">
                        <Loader2 className="animate-spin" size={12}/> RESETTING SYSTEM...
                     </div>
                </div>
            )}

        </div>
      </div>

      {/* FOOTER */}
      <div className="mt-4 text-center">
         <p className="text-[10px] text-slate-400 font-mono">POWERED BY BASETC PROTOCOL v1.0</p>
      </div>
    </div>
  );
}
