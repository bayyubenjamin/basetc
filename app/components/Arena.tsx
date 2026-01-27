"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatUnits, parseEther } from "viem";
import { base } from "viem/chains";
import { Loader2, Swords, Trophy, Shield } from "lucide-react";
import confetti from "canvas-confetti";

// CONFIG TERPUSAT
import { CFG } from "../lib/web3Config"; 

const ARENA_ADDRESS = CFG.addresses.ARENA;
const ARENA_ABI = CFG.abis.arena;
const BASETC_ADDRESS = CFG.addresses.BASETC;

// ABI Minimal untuk Cek Saldo & Approve Token BaseTC
const erc20Abi = [
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{type:"address"},{type:"address"}], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve",  stateMutability: "nonpayable", inputs: [{type:"address"},{type:"uint256"}], outputs: [{ type: "bool" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{type:"address"}], outputs: [{ type: "uint256" }] },
] as const;

export default function Arena() {
  const { address, chainId } = useAccount();
  const [betAmount, setBetAmount] = useState<string>("10");

  // --- BACA DATA KONTRAK (FIXED: Ganti watch:true dengan refetchInterval) ---
  const { data: nextLobbyId } = useReadContract({
    address: ARENA_ADDRESS as `0x${string}`,
    abi: ARENA_ABI,
    functionName: "nextLobbyId",
    // GANTI watch: true JADI INI:
    query: { 
      refetchInterval: 3000 // Refresh setiap 3 detik
    }
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: BASETC_ADDRESS as `0x${string}`,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, ARENA_ADDRESS as `0x${string}`] : undefined,
  });

  const { data: balance } = useReadContract({
    address: BASETC_ADDRESS as `0x${string}`,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  // --- TULIS TRANSAKSI ---
  const { writeContract: writeApprove, data: hashApprove, isPending: isPendingApprove } = useWriteContract();
  const { writeContract: writeCreate, data: hashCreate, isPending: isPendingCreate } = useWriteContract();
  const { writeContract: writeJoin, data: hashJoin, isPending: isPendingJoin } = useWriteContract();

  // --- TUNGGU TRANSAKSI SELESAI ---
  const { isSuccess: isSuccessApprove } = useWaitForTransactionReceipt({ hash: hashApprove });
  const { isSuccess: isSuccessCreate } = useWaitForTransactionReceipt({ hash: hashCreate });
  const { isSuccess: isSuccessJoin } = useWaitForTransactionReceipt({ hash: hashJoin });

  // Efek Samping: Refresh data & Efek Visual
  useEffect(() => {
    if (isSuccessApprove) refetchAllowance();
    if (isSuccessCreate || isSuccessJoin) {
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([50, 50, 50]);
      if (isSuccessJoin) {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      }
    }
  }, [isSuccessApprove, isSuccessCreate, isSuccessJoin, refetchAllowance]);

  // --- LOGIKA BUTTON ---
  const handleApprove = () => {
    if (!address) return; // Pastikan address ada
    writeApprove({
      address: BASETC_ADDRESS as `0x${string}`,
      abi: erc20Abi,
      functionName: "approve",
      account: address, // PERBAIKAN: Tambahkan account
      args: [ARENA_ADDRESS as `0x${string}`, parseEther("100000")],
      chain: base,
    });
  };

  const handleCreate = () => {
    if (!betAmount || !address) return; // Pastikan address ada
    writeCreate({
      address: ARENA_ADDRESS as `0x${string}`,
      abi: ARENA_ABI,
      functionName: "createLobby",
      account: address, // PERBAIKAN: Tambahkan account
      args: [parseEther(betAmount)],
      chain: base,
    });
  };

  const handleJoin = (id: bigint, amount: bigint) => {
    if (!allowance || allowance < amount) {
        handleApprove();
        return;
    }
    if (!address) return; // Pastikan address ada
    writeJoin({
      address: ARENA_ADDRESS as `0x${string}`,
      abi: ARENA_ABI,
      functionName: "joinLobby",
      account: address, // PERBAIKAN: Tambahkan account
      args: [id],
      chain: base,
    });
  };

  const isApproved = allowance && allowance >= parseEther(betAmount || "0");

  return (
    <div className="fin-wrap fin-content-pad-bottom pb-24">
      {/* HEADER */}
      <div className="fin-page-head mb-6">
        <div className="flex justify-between items-center">
            <div>
                <h1 className="text-3xl font-black tracking-tighter text-[var(--text)] flex items-center gap-2">
                    BATTLE ARENA <Swords className="text-red-500" />
                </h1>
                <p className="text-[var(--muted)] font-medium">PvP Battles. Winner takes all.</p>
            </div>
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-1 text-xs font-mono border border-gray-200">
                {balance ? parseFloat(formatUnits(balance, 18)).toFixed(0) : "0"} TC
            </div>
        </div>
      </div>

      {/* CARD BUAT TANTANGAN */}
      <section className="fin-card p-5 mb-6 neu bg-gradient-to-br from-gray-900 to-gray-800 text-white border-none shadow-xl">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Shield size={18} className="text-blue-400"/> Create Challenge
        </h2>
        
        <div className="flex gap-2 mb-4">
            {["10", "50", "100", "500"].map((amt) => (
                <button 
                    key={amt}
                    onClick={() => setBetAmount(amt)}
                    className={`flex-1 py-2 rounded-lg font-bold transition-all text-sm ${betAmount === amt ? 'bg-red-600 text-white shadow-lg shadow-red-900/50 scale-105' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                >
                    {amt}
                </button>
            ))}
        </div>

        <div className="flex gap-3">
            {!isApproved ? (
                <button 
                    onClick={handleApprove}
                    disabled={isPendingApprove}
                    className="w-full py-3 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-all text-sm"
                >
                    {isPendingApprove ? "Approving..." : "1. Approve Token"}
                </button>
            ) : (
                <button 
                    onClick={handleCreate}
                    disabled={isPendingCreate}
                    className="w-full py-3 rounded-xl font-bold bg-red-600 hover:bg-red-500 disabled:opacity-50 shadow-lg shadow-red-900/20 transition-all flex items-center justify-center gap-2 text-sm"
                >
                    {isPendingCreate ? <Loader2 className="animate-spin" /> : <><Swords size={18}/> FIGHT!</>}
                </button>
            )}
        </div>
        <p className="text-[10px] text-gray-400 mt-2 text-center opacity-70">5% Fee goes to treasury. Fair RNG on-chain.</p>
      </section>

      {/* LIST ARENA AKTIF */}
      <div className="mb-4 flex items-center justify-between">
         <h3 className="font-bold text-[var(--text)] text-lg">Active Lobbies</h3>
         <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full animate-pulse border border-red-200">LIVE</span>
      </div>

      <div className="space-y-3">
         {nextLobbyId && Number(nextLobbyId) > 1 ? (
             <LobbyList 
                maxId={Number(nextLobbyId)} 
                onJoin={handleJoin} 
                isPending={isPendingJoin}
                myAddress={address}
             />
         ) : (
             <div className="fin-card p-8 text-center text-[var(--muted)] border-dashed border-2">
                 <Swords size={40} className="mx-auto mb-3 opacity-20" />
                 <p className="font-semibold">No active battles.</p>
                 <p className="text-xs mt-1">Be the first to create one!</p>
             </div>
         )}
      </div>
    </div>
  );
}

// Sub-komponen untuk menampilkan list lobby
function LobbyList({ maxId, onJoin, isPending, myAddress }: { maxId: number, onJoin: any, isPending: boolean, myAddress?: string }) {
    const startId = Math.max(1, maxId - 10);
    const ids = Array.from({ length: maxId - startId }, (_, i) => maxId - 1 - i);

    return (
        <>
            {ids.map((id) => (
                <LobbyItem key={id} id={BigInt(id)} onJoin={onJoin} isPending={isPending} myAddress={myAddress} />
            ))}
        </>
    );
}

function LobbyItem({ id, onJoin, isPending, myAddress }: { id: bigint, onJoin: any, isPending: boolean, myAddress?: string }) {
    // Panggil fungsi 'lobbies' dari kontrak
    const { data: lobby } = useReadContract({
        address: ARENA_ADDRESS as `0x${string}`,
        abi: ARENA_ABI,
        functionName: "lobbies",
        args: [id],
        // Auto-refresh status lobby juga
        query: { refetchInterval: 5000 } 
    });

    if (!lobby || !lobby[2]) return null; // [2] adalah 'active'. Jika false, sembunyikan.

    const isMe = myAddress && lobby[0].toLowerCase() === myAddress.toLowerCase();

    return (
        <div className="fin-card p-4 flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 hover:scale-[1.02] transition-transform duration-200">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-[var(--accent)]/10 grid place-items-center text-lg shadow-sm">
                    🥊
                </div>
                <div>
                    <div className="font-black text-[var(--text)] text-lg">
                        {formatUnits(lobby[1], 18)} TC
                    </div>
                    <div className="text-xs text-[var(--muted)] font-mono flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
                        {lobby[0].slice(0, 6)}...{lobby[0].slice(-4)}
                    </div>
                </div>
            </div>
            
            {isMe ? (
                <button disabled className="px-4 py-2 bg-gray-100 text-gray-400 text-xs font-bold rounded-lg cursor-not-allowed border border-gray-200">
                    WAITING
                </button>
            ) : (
                <button 
                    onClick={() => onJoin(id, lobby[1])}
                    disabled={isPending}
                    className="px-5 py-2 bg-[var(--accent)] text-white text-sm font-bold rounded-lg shadow-lg hover:brightness-110 active:scale-95 transition-all"
                >
                    JOIN
                </button>
            )}
        </div>
    );
}
