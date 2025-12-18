"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useAccount } from "wagmi";

// Tipe data disesuaikan dengan output View SQL Anda
type LeaderboardItem = {
  rank: number;        // Kolom rank dari view
  fid: number;
  username: string | null;
  display_name: string | null;
  pfp_url: string | null;
  total_points: number;
};

const Leaderboard = () => {
  const { address } = useAccount(); // Opsional: jika ingin highlight user berdasar wallet (perlu mapping fid->wallet di masa depan)
  const [data, setData] = useState<LeaderboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Fungsi Fetch Data
  const fetchLeaderboard = useCallback(async () => {
    try {
      // Tambahkan timestamp 't' agar browser tidak men-cache request (selalu fresh)
      const response = await fetch(`/api/leaderboard?t=${new Date().getTime()}`, {
        cache: "no-store",
      });

      if (!response.ok) throw new Error("Gagal mengambil data leaderboard");
      
      const json = await response.json();
      setData(json.items || []);
    } catch (err: any) {
      console.error("Leaderboard Error:", err);
      if (data.length === 0) setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [data.length]);

  // 2. Setup Lifecycle & Realtime Listener
  useEffect(() => {
    // Load pertama
    fetchLeaderboard();

    // Event Handler: Dipanggil saat Spin/Mining selesai
    const handleRealtimeUpdate = () => {
      console.log("⚡ Leaderboard Refresh Triggered!");
      fetchLeaderboard();
    };

    // Pasang 'telinga' untuk mendengar event 'leaderboardUpdate'
    window.addEventListener("leaderboardUpdate", handleRealtimeUpdate);

    // Auto-refresh interval (backup setiap 15 detik)
    const interval = setInterval(fetchLeaderboard, 15000);

    return () => {
      window.removeEventListener("leaderboardUpdate", handleRealtimeUpdate);
      clearInterval(interval);
    };
  }, [fetchLeaderboard]);

  return (
    <div className="w-full">
      <div className="space-y-4 rounded-lg bg-neutral-900/50 p-4 border border-neutral-700 backdrop-blur-sm">
        
        {/* Header */}
        <div className="text-center mb-4 flex flex-col items-center justify-center">
          <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
            🏆 Global Leaderboard
            {/* Indikator Live Pulse */}
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Real-time Updates • Top 100
          </p>
        </div>

        {/* Tabel */}
        <div className="overflow-hidden rounded-md border border-neutral-800">
          <table className="min-w-full text-sm text-left">
            <thead className="bg-neutral-800 text-neutral-400 font-medium">
              <tr>
                <th className="px-4 py-3 text-center w-14">Rank</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3 text-right">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800 bg-neutral-900/30">
              
              {loading && data.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-neutral-500 animate-pulse">
                    Memuat data...
                  </td>
                </tr>
              )}

              {error && (
                <tr>
                  <td colSpan={3} className="px-4 py-4 text-center text-red-400 text-xs">
                    {error}
                  </td>
                </tr>
              )}
              
              {!loading && !error && data.length === 0 && (
                 <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-neutral-500">
                    Belum ada data poin.
                  </td>
                </tr>
              )}

              {data.map((item) => {
                // Styling Rank berdasarkan kolom 'rank' dari DB
                let rankIcon = <span className="text-neutral-500 font-mono">#{item.rank}</span>;
                let rankBg = "hover:bg-neutral-800/30";
                
                if (item.rank === 1) {
                  rankIcon = <span className="text-xl">🥇</span>;
                  rankBg = "bg-yellow-900/10 hover:bg-yellow-900/20";
                } else if (item.rank === 2) {
                  rankIcon = <span className="text-xl">🥈</span>;
                  rankBg = "bg-neutral-700/20 hover:bg-neutral-700/30";
                } else if (item.rank === 3) {
                  rankIcon = <span className="text-xl">🥉</span>;
                  rankBg = "bg-orange-900/10 hover:bg-orange-900/20";
                }

                return (
                  <tr key={item.fid} className={`transition-colors duration-300 ${rankBg}`}>
                    <td className="px-4 py-3 text-center font-bold">
                      {rankIcon}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div className="relative h-8 w-8 flex-shrink-0 overflow-hidden rounded-full border border-neutral-700 bg-neutral-800">
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
                            <div className="flex h-full w-full items-center justify-center text-[10px] text-neutral-500">
                              ?
                            </div>
                          )}
                        </div>
                        {/* Nama */}
                        <div className="flex flex-col">
                          <span className="font-medium text-neutral-200 truncate max-w-[140px]">
                            {item.display_name || "Unknown"}
                          </span>
                          <span className="text-[10px] text-neutral-500">
                            @{item.username || item.fid}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-white tabular-nums">
                      {item.total_points.toLocaleString()}
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
