// app/components/Leaderboard.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import EmptyState from "./EmptyState";

type LeaderboardItem = {
  rank: number;
  fid: number;
  username: string | null;
  display_name: string | null;
  pfp_url: string | null;
  total_points: number;
};

const Leaderboard = () => {
  // --- KONFIGURASI USER LOGIN ---
  // Masukkan FID user yang sedang login di sini.
  const currentUserFid = 0; // <--- GANTI INI DENGAN FID USER ASLI

  const [leaderboardData, setLeaderboardData] = useState<LeaderboardItem[]>([]);
  const [myRankData, setMyRankData] = useState<LeaderboardItem | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Fungsi Fetch Global Leaderboard (Top 100)
  const fetchLeaderboard = useCallback(async () => {
    try {
      const response = await fetch(`/api/leaderboard?_t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Pragma": "no-cache" }
      });
      if (!response.ok) throw new Error("Gagal mengambil data");
      const json = await response.json();
      const items = json.items || [];
      setLeaderboardData(items);
      return items;
    } catch (err: any) {
      console.error("Leaderboard Error:", err);
      if (leaderboardData.length === 0) setError(err.message);
      return [];
    }
  }, [leaderboardData.length]);

  // 2. Fungsi Fetch Data User Spesifik (Agar Rank > 100 tetap muncul)
  const fetchUserRank = useCallback(async (currentTop100: LeaderboardItem[]) => {
    if (!currentUserFid) return;

    // Cek dulu apakah user ada di Top 100 (hemat resource)
    const foundInTop100 = currentTop100.find(item => item.fid === currentUserFid);
    
    if (foundInTop100) {
      setMyRankData(foundInTop100);
    } else {
      // Jika TIDAK ada di Top 100, panggil API khusus user
      try {
        const response = await fetch(`/api/leaderboard/user?fid=${currentUserFid}&_t=${Date.now()}`);
        if (response.ok) {
            const userData = await response.json();
            if (userData && userData.rank) {
                setMyRankData(userData);
            }
        }
      } catch (e) {
        console.error("Gagal mengambil rank user spesifik", e);
      }
    }
  }, [currentUserFid]);

  // 3. Gabungkan Flow Fetching
  const refreshAllData = useCallback(async () => {
      const top100 = await fetchLeaderboard();
      await fetchUserRank(top100);
      setLoading(false);
  }, [fetchLeaderboard, fetchUserRank]);

  // Setup Lifecycle
  useEffect(() => {
    refreshAllData();

    const handleRealtimeUpdate = () => {
      console.log("⚡ Refresh Triggered!");
      refreshAllData();
    };

    window.addEventListener("leaderboardUpdate", handleRealtimeUpdate);
    const interval = setInterval(refreshAllData, 10000); // Refresh tiap 10 detik

    return () => {
      window.removeEventListener("leaderboardUpdate", handleRealtimeUpdate);
      clearInterval(interval);
    };
  }, [refreshAllData]);

  // [UPDATE: GG Feature] Fungsi Share ke Warpcast dengan Dynamic Frame v2
  const handleShareRank = () => {
    if (!myRankData) return;
    
    const rank = myRankData.rank;
    const points = myRankData.total_points;
    const username = myRankData.username || myRankData.display_name || "Miner";
    
    // Teks Viral agar memancing orang lain klik
    const text = `I'm ranked #${rank} on @basetc! ⛏️\n\nFarming real yield on Base. Can you beat my score?\n\n#BuildOnBase #BaseTC`;
    
    // URL DYNAMIC: Mengarah ke API Frame Generator, bukan sekadar link homepage
    const baseUrl = window.location.origin; 
    const embedUrl = `${baseUrl}/api/frame/rank?rank=${rank}&points=${points}&username=${encodeURIComponent(username)}`;
    
    const warpcastUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(embedUrl)}`;
    
    window.open(warpcastUrl, "_blank");
  };

  // Helper Render Reward
  const renderReward = (rank: number) => {
    if (rank <= 3) {
      return (
        <div className="flex items-center justify-end gap-1">
          <div className="relative w-4 h-4">
            <Image src="https://cryptologos.cc/logos/usd-coin-usdc-logo.png" alt="USDC" fill className="object-contain" />
          </div>
          {/* Penambahan tanda + */}
          <span className="text-[10px] font-bold text-gray-400">+</span>
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-tight">
            basetc
          </span>
        </div>
      );
    } else {
      // Rank 4 - 100 (dan seterusnya)
      return (
        <span className="text-[10px] font-bold text-blue-600 uppercase tracking-tight">
          basetc
        </span>
      );
    }
  };

  return (
    <div className="w-full pb-20 bg-gray-50 min-h-screen"> 
      
      <div className="max-w-md mx-auto p-4 space-y-4">
        
        {/* --- WARNING / INFO BANNER --- */}
        <div className="rounded-xl bg-amber-50 p-4 border border-amber-200 shadow-sm text-center relative overflow-hidden">
             {/* Decorative background element */}
            <div className="absolute top-0 right-0 -mt-2 -mr-2 w-8 h-8 bg-amber-100 rounded-full blur-xl opacity-50"></div>
            
            <h3 className="text-xs font-extrabold text-amber-700 uppercase tracking-wider mb-2 flex items-center justify-center gap-2">
                ⚠️ Trial Mode / Beta Testing
            </h3>
            <p className="text-[11px] text-amber-800/80 leading-relaxed font-medium">
                Rewards distribution has not started yet. The official start date will be announced soon.
            </p>
            <div className="mt-2 inline-block bg-amber-100 px-3 py-1 rounded-md">
                 <p className="text-[10px] font-bold text-amber-700">
                    NOTE: ALL POINTS WILL BE RESET
                </p>
            </div>
        </div>

        {/* --- BAGIAN MY RANK --- */}
        {myRankData && (
            <div className="rounded-xl bg-white p-4 border border-gray-200 shadow-sm ring-1 ring-gray-100 relative overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">My Rank</h3>
                    
                    {/* [UPDATE] Tombol Share */}
                    <button 
                      onClick={handleShareRank}
                      className="text-[10px] font-bold bg-black text-white px-3 py-1.5 rounded-full hover:bg-gray-800 transition-transform active:scale-95 flex items-center gap-1 shadow-sm"
                    >
                      Share Rank 🚀
                    </button>
                </div>
                
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600 font-bold text-lg shadow-inner">
                            #{myRankData.rank}
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-gray-900 leading-tight">
                                {myRankData.display_name || "Me"}
                            </span>
                            <span className="text-xs text-gray-500">
                                {myRankData.total_points.toLocaleString()} Points
                            </span>
                        </div>
                    </div>
                    <div className="text-right">
                        {renderReward(myRankData.rank)}
                    </div>
                </div>
            </div>
        )}

        {/* --- GLOBAL LEADERBOARD (Top 100) --- */}
        <div className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden">
            
            <div className="p-4 bg-white border-b border-gray-100 text-center">
                <h2 className="text-lg font-extrabold text-gray-900 tracking-tight flex items-center justify-center gap-2">
                    🏆 Global Leaderboard
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                </h2>
                <p className="text-xs text-gray-500 mt-1 font-medium bg-gray-100 inline-block px-3 py-1 rounded-full">
                    Daily Spin Points: 1 Spin = 5 Points
                </p>
            </div>

            <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200">
                <tr>
                    <th className="px-4 py-3 text-center w-14">#</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3 text-right">Points</th>
                    <th className="px-4 py-3 text-right">Reward</th> 
                </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                
                {loading && leaderboardData.length === 0 && (
                    <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-gray-400 animate-pulse">
                            Loading data...
                        </td>
                    </tr>
                )}
               {!loading && leaderboardData.length === 0 && (
                   <tr>
                        <td colSpan={4}>
                             <EmptyState
                               title="No builders found yet"
                               description="Be the first to join the leaderboard"
                                   />
                         </td>
                      </tr>
                )}


                {leaderboardData.map((item) => {
                    let rankIcon = <span className="text-gray-500 font-mono font-medium">#{item.rank}</span>;
                    let rankBg = "hover:bg-gray-50";
                    
                    if (item.rank === 1) {
                        rankIcon = <span className="text-xl drop-shadow-sm">🥇</span>;
                        rankBg = "bg-yellow-50/50 hover:bg-yellow-50";
                    } else if (item.rank === 2) {
                        rankIcon = <span className="text-xl drop-shadow-sm">🥈</span>;
                        rankBg = "bg-gray-50 hover:bg-gray-100";
                    } else if (item.rank === 3) {
                        rankIcon = <span className="text-xl drop-shadow-sm">🥉</span>;
                        rankBg = "bg-orange-50/50 hover:bg-orange-50";
                    }

                    const isMe = item.fid === currentUserFid;
                    if (isMe) rankBg = "bg-blue-50/60 hover:bg-blue-50";

                    return (
                    <tr key={item.fid} className={`transition-colors duration-200 ${rankBg}`}>
                        <td className="px-4 py-3 text-center font-bold">
                            {rankIcon}
                        </td>
                        <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                            <div className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-full border border-gray-200 bg-gray-100 shadow-sm">
                            {item.pfp_url ? (
                                <Image
                                src={item.pfp_url}
                                alt={item.username || "User"}
                                fill
                                sizes="36px"
                                className="object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-400 font-bold">?</div>
                            )}
                            </div>
                            <div className="flex flex-col justify-center">
                                <span className={`font-semibold text-sm truncate max-w-[100px] sm:max-w-[140px] ${isMe ? 'text-blue-700' : 'text-gray-900'}`}>
                                    {item.display_name || "Unknown"} {isMe && "(You)"}
                                </span>
                                <span className="text-[11px] text-gray-400">
                                    @{item.username || item.fid}
                                </span>
                            </div>
                        </div>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-gray-800 tabular-nums">
                            {item.total_points.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right align-middle">
                            {renderReward(item.rank)}
                        </td>
                    </tr>
                    );
                })}
                </tbody>
            </table>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
