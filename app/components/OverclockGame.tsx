"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatEther, parseEther } from "viem";
import { base } from "viem/chains";
import { Zap, AlertTriangle, Cpu, Loader2, Play, ShieldCheck, Info, TrendingUp, History, Coins } from "lucide-react";
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
  const [showTutorial, setShowTutorial] = useState(false);

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
      const [, level, active] = sessionData as [bigint, number, boolean];
      if (active) {
        setGameState("PLAYING");
      } else if (gameState === "PLAYING" && !active) {
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
      
      if (!allowance || (allowance as bigint) < amount) {
        const tx = await writeTx({
          address: BASETC_ADDRESS,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [OVERCLOCK_ADDRESS, parseEther("1000000000")],
          chain: base,
          account: address,
        });
        setLoading(true); // Keep loading while waiting for receipt
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
      setGameState("CRASHED");
      setTimeout(() => setGameState("IDLE"), 4000);
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
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#4ade80', '#ffffff', '#3b82f6'] });
      await refetchSession();
      setTimeout(() => setGameState("IDLE"), 5000);
    } catch (e) { console.error("Cashout Error:", e); }
    setLoading(false);
  };

  // --- UI VARIABLES ---
  const currentLevel = sessionData ? Number((sessionData as any)[1]) : 0;
  const betAmountRaw = sessionData ? (sessionData as any)[0] : parseEther(betInput);
  const betAmountEth = formatEther(betAmountRaw as bigint);
  const myBoost = Number(boostChance || 0);

  const LEVEL_DATA = [
    { name: "STABLE", mult: "1.0x", risk: "0%", color: "text-gray-400" },
    { name: "TURBO", mult: "1.2x", risk: "10%", color: "text-green-400" }, 
    { name: "NITRO", mult: "1.8x", risk: "30%", color: "text-yellow-400" }, 
    { name: "OVERVOLT", mult: "3.5x", risk: "50%", color: "text-orange-500" }, 
    { name: "SUPERNOVA", mult: "8.0x", risk: "70%", color: "text-red-500 animate-pulse" }, 
  ];

  const safeLevel = Math.min(currentLevel, LEVEL_DATA.length - 1);
  const currentMultiplier = parseFloat(LEVEL_DATA[safeLevel].mult);
  const potentialWin = (parseFloat(betAmountEth) * currentMultiplier).toFixed(2);
  const nextRisk = LEVEL_DATA[safeLevel + 1] ? parseInt(LEVEL_DATA[safeLevel + 1].risk) : 100;
  const actualRisk = Math.max(0, nextRisk - myBoost);

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="fin-card bg-gray-950/90 border border-white/10 p-0 overflow-hidden relative shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-[2.5rem]">
          {/* DYNAMIC AMBIENT GLOW */}
          <div className={`absolute inset-0 opacity-30 transition-all duration-1000 pointer-events-none 
              ${currentLevel === 0 ? 'bg-blue-600/20' : 
                currentLevel === 1 ? 'bg-green-600/20' :
                currentLevel === 2 ? 'bg-yellow-600/20' :
                currentLevel === 3 ? 'bg-orange-600/20' : 'bg-red-600/20'
              }`} 
          />

          {/* HEADER */}
          <div className="relative z-10 p-6 border-b border-white/5 bg-black/20 backdrop-blur-xl flex justify-between items-center">
              <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl bg-black/40 border border-white/10 ${currentLevel > 2 ? 'animate-pulse border-red-500/50' : ''}`}>
                    <Cpu className={`w-5 h-5 ${currentLevel > 2 ? "text-red-500" : "text-blue-400"}`} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black tracking-tight text-white uppercase italic">
                        Overclock <span className="text-blue-500 text-[10px] font-bold not-italic ml-1">v2.0</span>
                    </h2>
                  </div>
              </div>
              <button 
                onClick={() => setShowTutorial(!showTutorial)}
                className="p-2 rounded-full hover:bg-white/5 transition-colors text-gray-400"
              >
                <Info size={20} />
              </button>
          </div>

          {/* TUTORIAL OVERLAY */}
          {showTutorial && (
            <div className="absolute inset-0 z-50 bg-black/95 backdrop-blur-md p-8 animate-in fade-in zoom-in duration-300 overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2"><Info className="text-blue-500" /> How it Works</h3>
                <button onClick={() => setShowTutorial(false)} className="text-gray-500 font-bold">CLOSE</button>
              </div>
              <div className="space-y-4 text-sm text-gray-300 leading-relaxed">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                  <p className="font-bold text-blue-400 mb-1">1. Initialize System</p>
                  <p>Choose your $BaseTC bet amount to start the rig.</p>
                </div>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                  <p className="font-bold text-orange-400 mb-1">2. Boost Voltage</p>
                  <p>Each "Overclock" increases your multiplier but adds risk. If the system fails, the rig burns and the bet is lost.</p>
                </div>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                  <p className="font-bold text-green-400 mb-1">3. Secure Profit</p>
                  <p>Cash out at any time to secure your multiplied rewards. Rig NFTs reduce failure risk!</p>
                </div>
              </div>
            </div>
          )}

          {/* MAIN GAME ENGINE */}
          <div className="relative z-10 p-8 min-h-[350px] flex flex-col items-center justify-center">
              
              {gameState === "IDLE" && (
                  <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="text-center space-y-3">
                          <div className="relative inline-block">
                            <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full"></div>
                            <div className="relative p-6 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-[2rem] border border-blue-500/20">
                                <Play size={40} className="text-blue-400 fill-blue-400/20 ml-1" />
                            </div>
                          </div>
                          <h3 className="text-2xl font-black text-white tracking-tight">READY FOR LAUNCH</h3>
                          <p className="text-gray-400 text-xs font-medium max-w-[200px] mx-auto">Boost your rig power for up to <span className="text-yellow-400 font-bold">8.0x</span> multiplier.</p>
                      </div>

                      <div className="space-y-4">
                          <div className="flex justify-between items-end px-1">
                            <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Entry Stake</span>
                            <span className="text-[10px] text-blue-500 font-bold">BALANCE: {betAmountEth} TC</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                              {["100", "500", "1000"].map(amt => (
                                  <button key={amt} onClick={() => setBetInput(amt)} 
                                      className={`py-3 rounded-2xl text-xs font-black border transition-all ${betInput === amt ? "bg-blue-600 border-blue-400 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)]" : "bg-white/5 border-white/5 text-gray-500 hover:bg-white/10"}`}>
                                      {amt}
                                  </button>
                              ))}
                          </div>
                          <div className="relative">
                            <input 
                                type="number" 
                                value={betInput} 
                                onChange={(e) => setBetInput(e.target.value)}
                                className="w-full bg-black/60 border border-white/10 rounded-2xl py-4 px-6 text-white font-mono text-xl text-center focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                placeholder="0.00"
                            />
                            <Coins className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
                          </div>
                      </div>
                      
                      <button 
                          onClick={handleStart} 
                          disabled={loading}
                          className="w-full py-5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 bg-[length:200%_auto] hover:bg-right transition-all duration-500 rounded-2xl font-black text-white text-sm tracking-widest shadow-xl disabled:opacity-50 flex justify-center items-center gap-3 active:scale-95"
                      >
                          {loading ? <Loader2 className="animate-spin" /> : <>START ENGINE <Zap size={18} className="fill-current"/></>}
                      </button>
                  </div>
              )}

              {gameState === "PLAYING" && (
                  <div className="w-full text-center space-y-8 animate-in zoom-in-95 duration-500">
                      {/* RIG PERFORMANCE MONITOR */}
                      <div className="space-y-4">
                        <div className="flex justify-between items-center px-2">
                          <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Performance Output</span>
                          {myBoost > 0 && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-green-400 bg-green-400/10 px-2 py-0.5 rounded-md border border-green-400/20">
                              <ShieldCheck size={12} /> -{myBoost}% HEAT
                            </span>
                          )}
                        </div>
                        
                        <div className="relative h-24 flex items-center justify-center">
                          <div className="absolute inset-0 blur-3xl opacity-20 bg-current"></div>
                          <div className={`text-7xl font-black italic tracking-tighter ${LEVEL_DATA[safeLevel].color} drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] transition-all duration-500`}>
                              {LEVEL_DATA[safeLevel].mult}
                          </div>
                        </div>

                        <div className="flex flex-col items-center gap-1">
                          <div className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">Current Payout</div>
                          <div className="text-2xl font-mono font-bold text-white flex items-center gap-2">
                            {potentialWin} <span className="text-sm text-gray-500">TC</span>
                          </div>
                        </div>
                      </div>

                      {/* THERMAL BAR */}
                      <div className="space-y-3">
                          <div className="flex justify-between text-[9px] font-black text-gray-500 px-1">
                            <span>THERMAL LOAD</span>
                            <span className={actualRisk > 50 ? 'text-red-500' : 'text-gray-500'}>{actualRisk}% CRASH RISK</span>
                          </div>
                          <div className="relative h-3 bg-white/5 rounded-full overflow-hidden border border-white/5">
                               <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 via-yellow-500 to-red-500 transition-all duration-700 ease-out" 
                                    style={{width: `${(currentLevel / 4) * 100}%`}}></div>
                               <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer"></div>
                          </div>
                      </div>

                      {/* SYSTEM CONTROLS */}
                      <div className="grid grid-cols-2 gap-4">
                          <button 
                              onClick={handleCashout}
                              disabled={loading}
                              className="group py-4 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-2xl font-bold text-xs border border-white/10 transition-all flex flex-col items-center gap-1"
                          >
                              <TrendingUp size={16} className="text-green-500" />
                              CASHOUT
                          </button>

                          <button 
                              onClick={handleOverclock}
                              disabled={loading || currentLevel >= 4}
                              className="relative py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-black text-xs border-b-4 border-red-900 active:border-b-0 active:translate-y-1 transition-all flex flex-col items-center gap-1 group disabled:opacity-50"
                          >
                              {loading ? <Loader2 className="animate-spin" size={20}/> : (
                                  <>
                                      <Zap size={16} className="fill-white group-hover:animate-pulse"/>
                                      OVERCLOCK
                                  </>
                              )}
                          </button>
                      </div>
                  </div>
              )}

              {(gameState === "CRASHED" || gameState === "WON") && (
                  <div className="text-center py-10 animate-in zoom-in-90 duration-500 space-y-4">
                       <div className="relative">
                          <div className={`absolute inset-0 blur-3xl opacity-50 ${gameState === 'WON' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                          <div className="relative text-7xl mb-4 animate-bounce">{gameState === "WON" ? "🏆" : "💥"}</div>
                       </div>
                       <div>
                         <h3 className={`text-3xl font-black italic tracking-tight mb-2 ${gameState === "WON" ? "text-green-400" : "text-red-500"}`}>
                            {gameState === "WON" ? "SYSTEM PROFIT" : "CRITICAL FAILURE"}
                         </h3>
                         <p className="text-gray-400 text-sm font-medium">
                            {gameState === "WON" ? "Tokens transmitted to your wallet." : "Rig overheated. Bet destroyed."}
                         </p>
                       </div>
                       <div className="flex items-center justify-center gap-3 text-gray-500 pt-6">
                          <Loader2 className="animate-spin" size={18} />
                          <span className="text-[10px] font-black uppercase tracking-widest">Rebooting UI...</span>
                       </div>
                  </div>
              )}
          </div>

          {/* FOOTER STATS */}
          <div className="bg-white/5 border-t border-white/5 p-4 flex justify-around text-[9px] font-black text-gray-500 tracking-widest uppercase">
              <div className="flex items-center gap-2"><History size={12}/> Provably Fair</div>
              <div className="flex items-center gap-2"><ShieldCheck size={12}/> Verified RNG</div>
          </div>
      </div>
      
      {/* QUICK RULES PANEL */}
      <div className="bg-blue-500/5 border border-blue-500/10 rounded-3xl p-5 flex items-start gap-4">
        <div className="p-2 bg-blue-500/20 rounded-xl text-blue-400">
          <Zap size={20} />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-bold text-white">PRO TIP</p>
          <p className="text-[10px] text-gray-400 leading-relaxed">Holding **Legendary Rigs** significantly reduces your system failure rate, allowing you to chase the 8.0x Hazard multiplier more safely.</p>
        </div>
      </div>
    </div>
  );
}
