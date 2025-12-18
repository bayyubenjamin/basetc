"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

// Tipe data sesuai output dari API (View Database)
type LeaderboardItem = {
  fid: number;
  display_name: string | null;
  username: string | null;
  pfp_url: string | null;
  total_points: number;
};

const Leaderboard = () => {
  const [data, setData] = useState<LeaderboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch data real-time
  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setLoading(true);
        // Tambahkan timestamp agar tidak dicache browser
        const response = await fetch(`/api/leaderboard?t=${new Date().getTime()}`, {
          cache: "no-store",
        });

        if (!response.ok) throw new Error("Gagal mengambil data");
        
        const json = await response.json();
        setData(json.items || []);
      } catch (err: any) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
    
    // Auto refresh setiap 30 detik (Real-time feel)
    const interval = setInterval(fetchLeaderboard, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full">
      <div className="space-y-4 rounded-lg bg-neutral-900/50 p-4 border border-neutral-700 backdrop-blur-sm">
        
        {/* Header */}
        <div className="text-center mb-4">
          <h2 className="text-lg font-bold text-white tracking-wide">
            🏆 Global Leaderboard
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Real-time Updates
          </p>
        </div>

        {/* Tabel */}
        <div className="overflow-hidden rounded-md border border-neutral-800">
          <table className="min-w-full text-sm text-left">
            <thead className="bg-neutral-800 text-neutral-400 font-medium">
              <tr>
                <th className="px-4 py-3 text-center w-12">#</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3 text-right">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800 bg-neutral-900/30">
              
              {loading && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-neutral-500 animate-pulse">
                    Memuat data peringkat...
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

              {!loading && !error && data.map((item, index) => {
                const rank = index + 1;
                
                // Styling Ranking
                let rankIcon = <span className="text-neutral-500 font-mono">#{rank}</span>;
                let rankBg = "hover:bg-neutral-800/30";
                
                if (rank === 1) {
                  rankIcon = <span className="text-xl">🥇</span>;
                  rankBg = "bg-yellow-900/10 hover:bg-yellow-900/20";
                } else if (rank === 2) {
                  rankIcon = <span className="text-xl">🥈</span>;
                  rankBg = "bg-neutral-700/20 hover:bg-neutral-700/30";
                } else if (rank === 3) {
                  rankIcon = <span className="text-xl">🥉</span>;
                  rankBg = "bg-orange-900/10 hover:bg-orange-900/20";
                }

                return (
                  <tr key={item.fid} className={`transition-colors ${rankBg}`}>
                    {/* Kolom Rank */}
                    <td className="px-4 py-3 text-center font-bold">
                      {rankIcon}
                    </td>

                    {/* Kolom User (PFP + Nama) */}
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
                                // Fallback jika gambar error (opsional)
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[10px] text-neutral-500">
                              ?
                            </div>
                          )}
                        </div>
                        
                        {/* Nama & Username */}
                        <div className="flex flex-col">
                          <span className="font-medium text-neutral-200 truncate max-w-[120px]">
                            {item.display_name || "Unknown"}
                          </span>
                          <span className="text-[10px] text-neutral-500">
                            @{item.username || item.fid}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Kolom Poin */}
                    <td className="px-4 py-3 text-right font-bold text-white">
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
