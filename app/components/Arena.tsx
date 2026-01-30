// app/components/Arena.tsx
"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatUnits, parseEther } from "viem";
import { base } from "viem/chains";
import { Loader2, Swords, Shield, Info, TrendingUp, Zap, Clock, Cpu, Trophy } from "lucide-react";
import confetti from "canvas-confetti";
import { CFG } from "../lib/web3Config"; 

// IMPORT COMPONENT GAME BARU
import OverclockGame from "./OverclockGame";

// --- KONFIGURASI PVP ARENA (LAMA) ---
const ARENA_ADDRESS = CFG.addresses.ARENA;
const ARENA_ABI = CFG.abis.arena;
const BASETC_ADDRESS = CFG.addresses.BASETC;

const erc20Abi = [
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{type:"address"},{type:"address"}], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve",  stateMutability: "nonpayable", inputs: [{type:"address"},{type:"uint256"}], outputs: [{ type: "bool" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{type:"address"}], outputs: [{ type: "uint256" }] },
] as const;

// ==========================================
// MAIN COMPONENT (WRAPPER)
// ==========================================
export default function Arena() {
  // PERUBAHAN DISINI: Default state diganti ke "OVERCLOCK"
  const [activeTab, setActiveTab] = useState<"PVP" | "OVERCLOCK">("OVERCLOCK");

  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      {/* --- TAB NAVIGATION --- */}
      <div className="px-4 pt-4 mb-6">
        <div className="p-1 bg-white border border-gray-200 rounded-2xl flex relative overflow-hidden shadow-sm">
            {/* Active Indicator Background */}
            <div 
                className={`absolute inset-y-1 w-[calc(50%-4px)] bg-gray-100 rounded-xl shadow-sm transition-all duration-300 ease-out border border-gray-200
                ${activeTab === "PVP" ? "left-1" : "left-[calc(50%+4px)]"}`}
            ></div>

            {/* PVP Tab Button */}
            <button 
                onClick={() => setActiveTab("PVP")}
                className={`relative z-10 flex-1 py-3 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-colors duration-200
                ${activeTab === "PVP" ? "text-gray-900" : "text-gray-400 hover:text-gray-600"}`}
            >
                <Swords size={16} className={activeTab === "PVP" ? "text-red-600" : ""} />
                BATTLE ARENA
            </button>

            {/* Overclock Tab Button */}
            <button 
                onClick={() => setActiveTab("OVERCLOCK")}
                className={`relative z-10 flex-1 py-3 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-colors duration-200
                ${activeTab === "OVERCLOCK" ? "text-gray-900" : "text-gray-400 hover:text-gray-600"}`}
            >
                <Cpu size={16} className={activeTab === "OVERCLOCK" ? "text-blue-600" : ""} />
                OVERCLOCK
            </button>
        </div>
      </div>

      {/* --- CONTENT SWITCHER --- */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          {activeTab === "PVP" ? <PvPView /> : <OverclockViewWrapper />}
      </div>
    </div>
  );
}

// Wrapper untuk Overclock agar rapi
function OverclockViewWrapper() {
    return (
        <div className="px-4">
            <OverclockGame />
            <div className="text-center mt-6 text-[10px] text-gray-400 font-medium">
                <p>Switch to "Battle Arena" to fight other players.</p>
            </div>
        </div>
    );
}

// ==========================================
// PVP VIEW (ORIGINAL ARENA CODE)
// ==========================================
function PvPView() {
  const { address } = useAccount(); 
  const [betAmount, setBetAmount] = useState<string>("10");
  const [showRules, setShowRules] = useState(false);

  // --- BACA DATA KONTRAK ---
  const { data: nextLobbyId, isLoading: isLoadingLobby } = useReadContract({
    address: ARENA_ADDRESS as `0x${string}`,
    abi: ARENA_ABI,
    functionName: "nextLobbyId",
    query: { refetchInterval: 3000 } 
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: BASETC_ADDRESS as `0x${string}`,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, ARENA_ADDRESS as `0x${string}`] : undefined,
    query: { refetchInterval: 5000 }
  });

  const { data: balance } = useReadContract({
    address: BASETC_ADDRESS as `0x${string}`,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { refetchInterval: 5000 }
  });

  // --- WRITE TRANSACTIONS ---
  const { writeContract: writeApprove, data: hashApprove, isPending: isPendingApprove } = useWriteContract();
  const { writeContract: writeCreate, data: hashCreate, isPending: isPendingCreate } = useWriteContract();
  const { writeContract: writeJoin, data: hashJoin, isPending: isPendingJoin } = useWriteContract();

  const { isSuccess: isSuccessApprove } = useWaitForTransactionReceipt({ hash: hashApprove });
  const { isSuccess: isSuccessCreate } = useWaitForTransactionReceipt({ hash: hashCreate });
  const { isSuccess: isSuccessJoin } = useWaitForTransactionReceipt({ hash: hashJoin });

  // Efek Samping (Confetti & Vibrate)
  useEffect(() => {
    if (isSuccessApprove) refetchAllowance();
    if (isSuccessCreate || isSuccessJoin) {
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([50, 100, 50]);
      if (isSuccessJoin) {
        confetti({ 
            particleCount: 150, 
            spread: 80, 
            origin: { y: 0.6 },
            colors: ['#ef4444', '#3b82f6', '#fbbf24'] 
        });
      }
    }
  }, [isSuccessApprove, isSuccessCreate, isSuccessJoin, refetchAllowance]);

  // --- HANDLERS ---
  const handleApprove = () => {
    if (!address) return;
    writeApprove({
      address: BASETC_ADDRESS as `0x${string}`,
      abi: erc20Abi,
      functionName: "approve",
      args: [ARENA_ADDRESS as `0x${string}`, parseEther("1000000")],
      chain: base,
      account: address,
    });
  };

  const handleCreate = () => {
    if (!address || !betAmount) return;
    writeCreate({
      address: ARENA_ADDRESS as `0x${string}`,
      abi: ARENA_ABI,
      functionName: "createLobby",
      args: [parseEther(betAmount)],
      chain: base,
      account: address,
    });
  };

  const handleJoin = (id: bigint, amount: bigint) => {
    if (!address) return;
    if (!allowance || allowance < amount) {
        handleApprove();
        return;
    }
    writeJoin({
      address: ARENA_ADDRESS as `0x${string}`,
      abi: ARENA_ABI,
      functionName: "joinLobby",
      args: [id],
      chain: base,
      account: address,
    });
  };

  const isApproved = allowance && allowance >= parseEther(betAmount || "0");
  const userBalance = balance ? parseFloat(formatUnits(balance, 18)) : 0;

  return (
    <div className="fin-wrap fin-content-pad-bottom pb-32">
      {/* HEADER PREMIUM (LIGHT MODE ADJUSTED) */}
      <div className="fin-page-head mb-6 relative overflow-hidden rounded-b-3xl -mx-4 px-8 pb-8 pt-4 bg-gradient-to-br from-red-600 via-red-700 to-red-800 text-white shadow-xl">
        <div className="absolute top-0 right-0 p-4 opacity-20 animate-pulse">
            <Swords size={120} />
        </div>
        <div className="relative z-10 flex justify-between items-end">
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <span className="bg-white/20 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span> LIVE PVP
                    </span>
                </div>
                <h1 className="text-3xl font-black tracking-tighter italic flex items-center gap-2">
                    BATTLE ARENA
                </h1>
                <p className="text-red-100 text-sm font-medium opacity-90">Winner takes all. No mercy.</p>
            </div>
            <div className="text-right">
                <div className="text-[10px] text-red-200 uppercase tracking-widest font-bold">Your Balance</div>
                <div className="text-xl font-mono font-bold text-white">
                    {userBalance.toFixed(0)} <span className="text-sm text-red-200">TC</span>
                </div>
            </div>
        </div>
      </div>

      {/* GAME RULES TOGGLE */}
      <div className="px-4 mb-4">
          <button 
            onClick={() => setShowRules(!showRules)}
            className="group flex items-center justify-center gap-2 text-xs text-gray-500 hover:text-gray-800 transition-all mx-auto w-full py-2"
          >
              <Info size={14} className="group-hover:scale-110 transition-transform" /> 
              {showRules ? "Hide Rules" : "How to Play?"}
          </button>
          
          {showRules && (
              <div className="mt-2 p-4 bg-white border border-gray-200 rounded-2xl text-sm space-y-3 animate-in slide-in-from-top-2 shadow-sm">
                  <h3 className="font-bold flex items-center gap-2 text-gray-900"><Zap size={16} className="text-yellow-500"/> Game Rules</h3>
                  <ul className="list-disc list-inside space-y-1.5 text-gray-600 text-xs leading-relaxed">
                      <li><strong>Create Lobby:</strong> Set your bet amount and wait for a challenger.</li>
                      <li><strong>Join Battle:</strong> Accept a challenge. The battle happens instantly on-chain.</li>
                      <li><strong>Winning:</strong> Winner is decided by <strong>Rig Power (NFT Tier)</strong> + <strong>Luck (RNG)</strong>.</li>
                      <li><strong>Prize:</strong> Winner gets <strong>190%</strong> of the bet (5% Protocol Fee).</li>
                  </ul>
              </div>
          )}
      </div>

      {/* CREATE CHALLENGE CARD */}
      <section className="mx-4 mb-8 overflow-hidden rounded-2xl shadow-lg border border-gray-200 bg-white">
        <div className="p-6 relative">
            <h2 className="text-lg font-bold mb-5 flex items-center gap-2 text-gray-900">
                <Shield size={20} className="text-red-600"/> Create Challenge
            </h2>
            
            <div className="grid grid-cols-4 gap-3 mb-6 relative z-10">
                {["10", "50", "100", "500"].map((amt) => (
                    <button 
                        key={amt}
                        onClick={() => setBetAmount(amt)}
                        className={`relative py-3 rounded-xl font-bold transition-all duration-200 text-sm border ${betAmount === amt ? 'bg-red-600 border-red-600 text-white shadow-md scale-105' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}
                    >
                        {amt}
                    </button>
                ))}
            </div>

            <div className="flex gap-3 relative z-10">
                {!isApproved ? (
                    <button 
                        onClick={handleApprove}
                        disabled={isPendingApprove}
                        className="w-full py-4 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-all text-sm flex items-center justify-center gap-2 shadow-md"
                    >
                        {isPendingApprove ? <Loader2 className="animate-spin" /> : "1. UNLOCK WALLET"}
                    </button>
                ) : (
                    <button 
                        onClick={handleCreate}
                        disabled={isPendingCreate}
                        className="w-full py-4 rounded-xl font-black bg-gradient-to-r from-red-600 to-orange-500 text-white hover:opacity-90 disabled:opacity-50 shadow-md transition-all flex items-center justify-center gap-2 text-sm tracking-wide transform active:scale-95"
                    >
                        {isPendingCreate ? <Loader2 className="animate-spin" /> : <><Swords size={18} /> FIGHT NOW</>}
                    </button>
                )}
            </div>
        </div>
        <div className="bg-gray-50 px-5 py-3 flex justify-between items-center text-[10px] text-gray-400 font-mono border-t border-gray-100">
            <span>FEE: 5% (Treasury)</span>
            <span className="flex items-center gap-1 opacity-80"><Shield size={10}/> SECURE RNG</span>
        </div>
      </section>

      {/* LOBBY LIST SECTION */}
      <div className="px-4">
        <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                <TrendingUp size={18} className="text-green-600"/> Active Lobbies
            </h3>
            <div className="flex items-center gap-2 text-[10px] text-gray-500 bg-white px-2 py-1 rounded-lg border border-gray-200">
                 <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                Live Updates
            </div>
        </div>

        <div className="space-y-3 pb-8 min-h-[200px]">
            {isLoadingLobby ? (
                <>
                    <SkeletonRow delay="0s" />
                    <SkeletonRow delay="0.1s" />
                    <SkeletonRow delay="0.2s" />
                </>
            ) : nextLobbyId && Number(nextLobbyId) > 1 ? (
                <LobbyList 
                    maxId={Number(nextLobbyId)} 
                    onJoin={handleJoin} 
                    isPending={isPendingJoin}
                    myAddress={address}
                />
            ) : (
                <div className="p-10 text-center text-gray-400 border-dashed border-2 border-gray-200 bg-white rounded-2xl animate-in fade-in zoom-in-95 duration-500">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-50 rounded-full flex items-center justify-center">
                        <Swords size={32} className="opacity-20 text-gray-900" />
                    </div>
                    <p className="font-bold text-lg text-gray-900">No active battles</p>
                    <p className="text-xs mt-1">Be the first gladiator to enter the arena!</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}

// 1. Skeleton Loading Row
function SkeletonRow({ delay }: { delay: string }) {
    return (
        <div 
            className="h-[80px] w-full bg-white rounded-2xl border border-gray-200 relative overflow-hidden"
            style={{ animationDelay: delay }}
        >
            <div className="flex items-center justify-between p-4 h-full">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-gray-100 animate-pulse"></div>
                    <div className="space-y-2">
                        <div className="h-4 w-24 bg-gray-100 rounded animate-pulse"></div>
                        <div className="h-3 w-16 bg-gray-100 rounded animate-pulse"></div>
                    </div>
                </div>
                <div className="h-8 w-20 bg-gray-100 rounded-lg animate-pulse"></div>
            </div>
        </div>
    );
}

// 2. Optimized List
function LobbyList({ maxId, onJoin, isPending, myAddress }: { maxId: number, onJoin: any, isPending: boolean, myAddress?: string }) {
    const startId = Math.max(1, maxId - 15);
    const ids = Array.from({ length: maxId - startId }, (_, i) => maxId - 1 - i);

    return (
        <>
            {ids.map((id) => (
                <LobbyItem key={id} id={BigInt(id)} onJoin={onJoin} isPending={isPending} myAddress={myAddress} />
            ))}
        </>
    );
}

// 3. Lobby Row Item
function LobbyItem({ id, onJoin, isPending, myAddress }: { id: bigint, onJoin: any, isPending: boolean, myAddress?: string }) {
    const { data: lobby } = useReadContract({
        address: ARENA_ADDRESS as `0x${string}`,
        abi: ARENA_ABI,
        functionName: "lobbies",
        args: [id],
        query: { refetchInterval: 3000 } 
    });

    if (!lobby || !lobby[2]) return null; 

    const isMe = myAddress && lobby[0].toLowerCase() === myAddress.toLowerCase();
    const shortAddress = `${lobby[0].slice(0, 6)}...${lobby[0].slice(-4)}`;

    return (
        <div className="group relative bg-white border border-gray-200 p-4 rounded-2xl flex items-center justify-between transition-all hover:border-blue-500 hover:shadow-md animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-4">
                <div className="relative">
                    <div className="h-12 w-12 rounded-xl bg-gray-50 grid place-items-center text-2xl border border-gray-100">
                        🥊
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-green-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold border-2 border-white shadow-sm">
                        P1
                    </div>
                </div>
                <div>
                    <div className="font-black text-gray-900 text-xl leading-none flex items-baseline gap-1">
                        {formatUnits(lobby[1], 18)} <span className="text-xs text-gray-400 font-medium">TC</span>
                    </div>
                    <div className="text-xs text-gray-500 font-mono mt-1.5 flex items-center gap-1.5">
                        <div className="flex -space-x-1">
                            <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-white"></div>
                            <div className="w-4 h-4 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[8px] font-bold text-gray-400">?</div>
                        </div>
                        vs <span className="text-gray-900 font-semibold bg-gray-100 px-1.5 py-0.5 rounded-md">{isMe ? "YOU" : shortAddress}</span>
                    </div>
                </div>
            </div>
            
            {isMe ? (
                <button disabled className="px-5 py-2.5 bg-gray-50 text-gray-400 text-xs font-bold rounded-xl cursor-not-allowed border border-dashed border-gray-200 flex items-center gap-2">
                    <Clock size={12}/> WAITING
                </button>
            ) : (
                <button 
                    onClick={() => onJoin(id, lobby[1])}
                    disabled={isPending}
                    className="relative overflow-hidden px-6 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl shadow-sm hover:bg-blue-700 active:scale-95 transition-all"
                >
                    <span className="relative z-10 flex items-center gap-1.5">
                        JOIN <Swords size={14} />
                    </span>
                </button>
            )}
        </div>
    );
}
