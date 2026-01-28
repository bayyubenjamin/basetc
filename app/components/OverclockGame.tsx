"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { formatEther, parseEther } from "viem";
import { base } from "viem/chains";
import { Zap, AlertTriangle, Cpu, Loader2, Play, Trophy, ShieldCheck } from "lucide-react";
import confetti from "canvas-confetti";
import { CFG } from "../lib/web3Config";

// Setup Config dari file web3Config
const OVERCLOCK_ADDRESS = CFG.addresses.OVERCLOCK as `0x${string}`;
const BASETC_ADDRESS = CFG.addresses.BASETC as `0x${string}`;
const OVERCLOCK_ABI = CFG.abis.overclock;
const ERC20_ABI = CFG.abis.baseTc;

export default function OverclockGame() {
  const { address } = useAccount();
  const [betInput, setBetInput] = useState("100");
  const [gameState, setGameState] = useState<"IDLE" | "PLAYING" | "CRASHED" | "WON">("IDLE");
  const [loading, setLoading] = useState(false);

  // --- CONTRACT READS ---
  const { data: sessionData, refetch: refetchSession } = useReadContract({
    address: OVERCLOCK_ADDRESS,
    abi: OVERCLOCK_ABI,
    functionName: "sessions",
    args: address ? [address] : undefined,
    query: { refetchInterval: 2000 }
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
  });

  // --- WRITE HOOKS ---
  const { writeContractAsync: writeTx } = useWriteContract();

  // Sync State Realtime
  useEffect(() => {
    if (sessionData) {
      const [amount, level, active] = sessionData as [bigint, number, boolean];
      if (active) {
        setGameState("PLAYING");
      } else if (gameState === "PLAYING" && !active) {
        // Jika status berubah jadi tidak aktif saat sedang main, cek history atau reset
        // Untuk simplifikasi UI, kita reset ke IDLE jika tidak ada event log spesifik
        // (Idealnya listen event, tapi ini cukup aman)
        setGameState("IDLE"); 
      }
    }
  }, [sessionData, gameState]);

  // --- ACTIONS ---
  const handleStart = async () => {
    if (!address) return;
    setLoading(true);
    try {
      const amount = parseEther(betInput);
      
      // 1. Cek & Approve Allowance
      if (!allowance || allowance < amount) {
        await writeTx({
          address: BASETC_ADDRESS,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [OVERCLOCK_ADDRESS, parseEther("1000000")],
          chain: base,
          account: address,
        });
        await refetchAllowance();
      }

      // 2. Start Game Transaction
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
    } catch (e) { console.error("Start Error:", e); }
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
      // Asumsi error disini kemungkinan besar karena RNG fail (Crash)
      setGameState("CRASHED");
      setTimeout(() => setGameState("IDLE"), 3000); // Auto reset setelah 3 detik
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
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#4ade80', '#ffffff'] });
      await refetchSession();
      setTimeout(() => setGameState("IDLE"), 4000);
    } catch (e) { console.error("Cashout Error:", e); }
    setLoading(false);
  };

  // --- UI VARIABLES ---
  const currentLevel = sessionData ? Number(sessionData[1]) : 0;
  // Default values jika sessionData belum load
  const betAmountRaw = sessionData ? sessionData[0] : parseEther(betInput);
  const betAmountEth = formatEther(betAmountRaw as bigint);
  const myBoost = Number(boostChance || 0);

  const LEVEL_DATA = [
    { name: "SAFE MODE", mult: "1.0x", risk: "0%", color: "text-gray-400" },
    { name: "MILD OC", mult: "1.2x", risk: "10%", color: "text-green-400" }, // Lvl 1
    { name: "HIGH VOLT", mult: "1.8x", risk: "30%", color: "text-yellow-400" }, // Lvl 2
    { name: "EXTREME", mult: "3.5x", risk: "50%", color: "text-orange-500" }, // Lvl 3
    { name: "HAZARD", mult: "8.0x", risk: "70%", color: "text-red-600 animate-pulse" }, // Lvl 4
  ];

  // Safety check array bounds
  const safeLevel = Math.min(currentLevel, LEVEL_DATA.length - 1);
  const currentMultiplier = parseFloat(LEVEL_DATA[safeLevel].mult);
  const potentialWin = (parseFloat(betAmountEth) * currentMultiplier).toFixed(2);
  const nextRisk = LEVEL_DATA[safeLevel + 1] ? parseInt(LEVEL_DATA[safeLevel + 1].risk) : 100;
  const actualRisk = Math.max(0, nextRisk - myBoost);

  return (
    <div className="fin-card bg-gray-950/80 border border-blue-900/50 p-0 overflow-hidden relative shadow-2xl rounded-3xl max-w-md mx-auto">
        
        {/* ANIMATED BACKGROUND */}
        <div className={`absolute inset-0 opacity-20 transition-all duration-700 pointer-events-none 
            ${currentLevel === 0 ? 'bg-gradient-to-b from-blue-900 to-black' : 
              currentLevel === 1 ? 'bg-gradient-to-b from-green-900 to-black' :
              currentLevel === 2 ? 'bg-gradient-to-b from-yellow-900 to-black' :
              currentLevel === 3 ? 'bg-gradient-to-b from-orange-900 to-black' : 'bg-gradient-to-b from-red-900 to-black'
            }`} 
        />

        {/* HEADER */}
        <div className="relative z-10 p-6 border-b border-white/5 bg-white/5 backdrop-blur-sm flex justify-between items-center">
            <div className="flex items-center gap-2">
                <Cpu className={`w-6 h-6 ${currentLevel > 2 ? "text-red-500 animate-pulse" : "text-blue-400"}`} />
                <h2 className="text-xl font-black italic tracking-tighter text-white">
                    OVERCLOCK <span className="text-blue-500 text-xs not-italic font-normal block tracking-normal">Lab Simulation</span>
                </h2>
            </div>
            {myBoost > 0 && (
                <div className="flex items-center gap-1.5 text-[10px] font-bold bg-green-900/40 text-green-400 px-2.5 py-1 rounded-full border border-green-500/30">
                    <ShieldCheck size={12} />
                    RIG BOOST -{myBoost}% RISK
                </div>
            )}
        </div>

        {/* MAIN GAME AREA */}
        <div className="relative z-10 p-6 min-h-[300px] flex flex-col items-center justify-center">
            
            {gameState === "IDLE" && (
                <div className="w-full space-y-6 animate-in fade-in zoom-in duration-300">
                    <div className="text-center space-y-2">
                        <div className="inline-block p-4 bg-blue-500/10 rounded-full mb-2 ring-1 ring-blue-500/50">
                            <Play size={32} className="text-blue-400 ml-1" />
                        </div>
                        <h3 className="text-white font-bold text-lg">Ready to Overclock?</h3>
                        <p className="text-gray-400 text-xs">Push your rig limits for up to <span className="text-yellow-400 font-bold">8.0x</span> rewards.</p>
                    </div>

                    <div className="space-y-3">
                        <div className="text-xs text-gray-500 font-mono uppercase ml-1">Bet Amount ($TC)</div>
                        <div className="grid grid-cols-3 gap-2">
                            {["100", "500", "1000"].map(amt => (
                                <button key={amt} onClick={() => setBetInput(amt)} 
                                    className={`py-2.5 rounded-xl text-sm font-bold border transition-all ${betInput === amt ? "bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-900/50" : "bg-gray-800/50 border-gray-700 text-gray-400 hover:bg-gray-800"}`}>
                                    {amt}
                                </button>
                            ))}
                        </div>
                        <input 
                            type="number" 
                            value={betInput} 
                            onChange={(e) => setBetInput(e.target.value)}
                            className="w-full bg-black/40 border border-gray-700 rounded-xl p-3 text-white font-mono text-center focus:outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>
                    
                    <button 
                        onClick={handleStart} 
                        disabled={loading}
                        className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl font-black text-white text-sm tracking-wide shadow-xl shadow-blue-900/20 active:scale-95 transition-all flex justify-center items-center gap-2 group"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : <>INITIALIZE SYSTEM <Zap size={16} className="group-hover:text-yellow-300 transition-colors"/></>}
                    </button>
                </div>
            )}

            {gameState === "PLAYING" && (
                <div className="w-full text-center space-y-6">
                    {/* Level Progress Bar */}
                    <div className="relative px-2 pt-4 pb-2">
                         <div className="absolute top-1/2 left-0 w-full h-1.5 bg-gray-800 rounded-full -z-10 mt-1"></div>
                         {/* Active Bar */}
                         <div className="absolute top-1/2 left-0 h-1.5 bg-gradient-to-r from-blue-500 via-yellow-500 to-red-500 rounded-full -z-10 mt-1 transition-all duration-500 ease-out" 
                              style={{width: `${(currentLevel / 4) * 100}%`}}></div>
                        
                        <div className="flex justify-between relative">
                            {[0, 1, 2, 3, 4].map(lvl => (
                                <div key={lvl} className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[10px] border-2 transition-all duration-300 z-10
                                    ${currentLevel >= lvl ? 
                                        "bg-white text-black border-blue-500 scale-110 shadow-[0_0_15px_rgba(59,130,246,0.5)]" : 
                                        "bg-gray-900 text-gray-600 border-gray-800"}`}>
                                    {lvl === 0 ? "S" : lvl}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Stats Display */}
                    <div className="py-2">
                        <div className="text-gray-500 text-[10px] tracking-[0.2em] uppercase mb-1">Current Multiplier</div>
                        <div className={`text-6xl font-black ${LEVEL_DATA[safeLevel].color} drop-shadow-2xl transition-all scale-100 animate-in zoom-in duration-300`}>
                            {LEVEL_DATA[safeLevel].mult}
                        </div>
                        <div className="mt-2 inline-flex items-center gap-2 bg-white/5 px-4 py-1.5 rounded-lg border border-white/10">
                            <span className="text-gray-400 text-xs">Profit:</span>
                            <span className="text-white font-mono font-bold">{potentialWin} TC</span>
                        </div>
                    </div>

                    {/* Risk Indicator */}
                    {currentLevel < 4 && (
                        <div className="bg-red-950/30 border border-red-500/20 p-2.5 rounded-lg text-xs text-red-300 flex items-center justify-center gap-2 animate-pulse">
                            <AlertTriangle size={14} className="text-red-500"/> 
                            Failure Risk: <span className="font-bold text-red-100">{actualRisk}%</span>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <button 
                            onClick={handleCashout}
                            disabled={loading}
                            className="py-3.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl font-bold text-xs border border-gray-600 transition-all active:scale-95"
                        >
                            SECURE PROFIT
                        </button>

                        <button 
                            onClick={handleOverclock}
                            disabled={loading || currentLevel >= 4}
                            className="relative py-3.5 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white rounded-xl font-black text-xs border-b-4 border-red-800 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? <Loader2 className="animate-spin" size={16}/> : (
                                <>
                                    BOOST VOLTAGE <Zap size={16} className="fill-white group-hover:scale-110 transition-transform"/>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {gameState === "CRASHED" && (
                <div className="text-center animate-in zoom-in duration-300">
                     <div className="text-6xl mb-4 animate-bounce">💥</div>
                     <h3 className="text-2xl font-black text-red-500 mb-1">SYSTEM FAILURE</h3>
                     <p className="text-gray-400 text-sm mb-6">Rig overheated. Cooling down...</p>
                     <Loader2 className="animate-spin mx-auto text-gray-600" size={24}/>
                </div>
            )}

            {gameState === "WON" && (
                <div className="text-center animate-in zoom-in duration-300">
                     <div className="text-6xl mb-4 animate-bounce">🏆</div>
                     <h3 className="text-2xl font-black text-green-400 mb-1">SUCCESS!</h3>
                     <p className="text-gray-400 text-sm mb-6">Profit secured to wallet.</p>
                     <div className="text-xs text-blue-400">Redirecting...</div>
                </div>
            )}
        </div>
    </div>
  );
}
