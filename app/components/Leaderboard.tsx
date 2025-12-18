"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useAccount } from "wagmi";

// Tipe data disesuaikan (tambahkan address jika API mengembalikan address untuk pencocokan My Rank)
type LeaderboardItem = {
  rank: number;
  fid: number;
  username: string | null;
  display_name: string | null;
  pfp_url: string | null;
  total_points: number;
  address?: string; // Opsional: dibutuhkan untuk mencocokkan "My Rank" dengan useAccount
};

const Leaderboard = () => {
  const { address } = useAccount(); 
  const [data, setData] = useState<LeaderboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cari data user yang sedang login untuk "My Rank"
  // Logika: Mencocokkan address wallet atau username (sesuaikan dengan data yang tersedia di API)
  const myRankData = data.find((item) => 
    (item.address && item.address.toLowerCase() === address?.toLowerCase()) 
    // atau jika Anda punya FID user lokal: item.fid === userFid
  );

  // 1. Fungsi Fetch Data
  const fetchLeaderboard = useCallback(async () => {
    try {
      const response = await fetch(`/api/leaderboard?_t=${Date.now()}`, {
        cache: "no-store",
        headers: {
            "Pragma": "no-cache"
        }
      });

      if (!response.ok) throw new Error("Gagal mengambil data leaderboard");
      
      const json = await response.json();
      setData(json.items || []);
      setLoading(false);
    } catch (err: any) {
      console.error("Leaderboard Error:", err);
      if (data.length === 0) setError(err.message);
      setLoading(false);
    }
  }, [data.length]);

  // 2. Setup Lifecycle & Realtime Listener
  useEffect(() => {
    fetchLeaderboard();

    const handleRealtimeUpdate = () => {
      console.log("⚡ Leaderboard Refresh Triggered!");
      fetchLeaderboard();
    };

    window.addEventListener("leaderboardUpdate", handleRealtimeUpdate);
    const interval = setInterval(() => {
        fetchLeaderboard();
    }, 10000);

    return () => {
      window.removeEventListener("leaderboardUpdate", handleRealtimeUpdate);
      clearInterval(interval);
    };
  }, [fetchLeaderboard]);

  return (
    <div className="w-full pb-20"> 
      
      {/* --- BAGIAN MY RANK --- */}
      {address && (
        <div className="mb-6 rounded-xl bg-white p-4 border border-gray-200 shadow-sm">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">My Rank</h3>
            {myRankData ? (
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-bold text-lg">
                            #{myRankData.rank}
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-gray-900">{myRankData.display_name}</span>
                            <span className="text-xs text-gray-500">{myRankData.total_points.toLocaleString()} Points</span>
                        </div>
                    </div>
                    <div className="text-right">
                         {/* Reward Logic untuk My Rank */}
                         {myRankData.rank <= 3 ? (
                            <div className="flex flex-col items-end">
                                <div className="flex items-center gap-1">
                                    <div className="relative w-4 h-4">
                                        <Image src="/usdc-logo.png" alt="USDC" fill className="object-contain" />
                                    </div>
                                    <span className="text-[10px] font-bold text-blue-600 uppercase">basetc</span>
                                </div>
                            </div>
                        ) : (
                            <span className="text-[10px] font-bold text-blue-600 uppercase">basetc</span>
                        )}
                    </div>
                </div>
            ) : (
                <div className="text-sm text-gray-400 italic">
                    You are not in the top list yet or wallet not connected to profile.
                </div>
            )}
        </div>
      )}

      {/* --- BAGIAN LEADERBOARD UTAMA --- */}
      <div className="space-y-4 rounded-xl bg-white/80 p-3 sm:p-4 border border-gray-200 shadow-sm backdrop-blur-sm">
        
        {/* Header */}
        <div className="text-center mb-4 flex flex-col items-center justify-center">
          <h2 className="text-lg font-bold text-gray-900 tracking-wide flex items-center gap-2">
            🏆 Global Leaderboard
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
          </h2>
          {/* Ubah Tulisan Real time menjadi Daily Spin Points */}
          <p className="text-xs text-gray-500 mt-1 font-medium">
            Daily Spin Points: 1 Spin = 5 Points
          </p>
        </div>

        {/* Tabel Wrapper */}
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm text-left whitespace-nowrap bg-white">
            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
              <tr>
                <th className="px-3 py-3 text-center w-12">#</th>
                <th className="px-3 py-3">User</th>
                <th className="px-3 py-3 text-right">Points</th>
                {/* Kolom baru untuk Reward */}
                <th className="px-3 py-3 text-right">Reward</th> 
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              
              {loading && data.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400 animate-pulse">
                    Loading leaderboard...
                  </td>
                </tr>
              )}

              {error && (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-center text-red-500 text-xs">
                    {error}
                  </td>
                </tr>
              )}
              
              {!loading && !error && data.length === 0 && (
                 <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    No data available.
                  </td>
                </tr>
              )}

              {data.map((item) => {
                let rankIcon = <span className="text-gray-500 font-mono">#{item.rank}</span>;
                let rankBg = "hover:bg-gray-50";
                
                if (item.rank === 1) {
                  rankIcon = <span className="text-xl">🥇</span>;
                  rankBg = "bg-yellow-50 hover:bg-yellow-100";
                } else if (item.rank === 2) {
                  rankIcon = <span className="text-xl">🥈</span>;
                  rankBg = "bg-gray-100 hover:bg-gray-200";
                } else if (item.rank === 3) {
                  rankIcon = <span className="text-xl">🥉</span>;
                  rankBg = "bg-orange-50 hover:bg-orange-100";
                }

                return (
                  <tr key={item.fid} className={`transition-colors duration-300 ${rankBg}`}>
                    <td className="px-3 py-3 text-center font-bold">
                      {rankIcon}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2 sm:gap-3">
                        {/* Avatar */}
                        <div className="relative h-8 w-8 flex-shrink-0 overflow-hidden rounded-full border border-gray-200 bg-gray-100">
                          {item.pfp_url ? (
                            <Image
                              src={item.pfp_url}
                              alt={item.username || "User"}
                              fill
                              sizes="32px"
                              className="object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">
                              ?
                            </div>
                          )}
                        </div>
                        {/* Nama */}
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900 truncate max-w-[100px] sm:max-w-[140px]">
                            {item.display_name || "Unknown"}
                          </span>
                          <span className="text-[10px] text-gray-500">
                            @{item.username || item.fid}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-gray-800 tabular-nums">
                      {item.total_points.toLocaleString()}
                    </td>
                    
                    {/* --- LOGIKA REWARD --- */}
                    <td className="px-3 py-3 text-right align-middle">
                      {item.rank <= 3 ? (
                        <div className="flex items-center justify-end gap-1">
                          {/* Pastikan file usdc-logo.png ada di folder public/ */}
                          <div className="relative w-5 h-5">
                            <Image 
                                src="/usdc-logo.png" 
                                alt="USDC" 
                                fill 
                                className="object-contain" 
                            />
                          </div>
                          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-tight">
                            basetc
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-blue-600 uppercase tracking-tight">
                            basetc
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
