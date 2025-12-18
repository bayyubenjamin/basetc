'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';

// Tipe data sesuai return dari API leaderboard Anda
type LeaderboardItem = {
  user_address: string;
  daily_score: number; // atau 'points' tergantung nama kolom di view database Anda
};

export default function Leaderboard() {
  const { address } = useAccount();
  const [data, setData] = useState<LeaderboardItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Fungsi untuk memendekkan address (0x1234...abcd)
  const shortenAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // Fetch data dari API
  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await fetch('/api/leaderboard');
        const json = await res.json();
        
        if (json.items) {
          setData(json.items);
        }
      } catch (error) {
        console.error('Gagal memuat leaderboard', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  return (
    <div className="w-full max-w-md mx-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-white">Daily Leaderboard</h2>
          <p className="text-xs text-gray-400">Reset pukul 07:00 WIB</p>
        </div>
        <div className="text-right">
          <span className="text-xs bg-blue-900 text-blue-200 px-2 py-1 rounded border border-blue-700">
            Top 100
          </span>
        </div>
      </div>

      {/* List Leaderboard */}
      <div className="bg-black/40 border border-white/10 rounded-xl overflow-hidden backdrop-blur-md">
        {loading ? (
          <div className="p-8 text-center text-gray-400 animate-pulse">
            Memuat data...
          </div>
        ) : data.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Belum ada aktivitas hari ini.
            <br />
            <span className="text-sm">Jadilah yang pertama!</span>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {/* Header Kolom */}
            <div className="grid grid-cols-12 gap-2 p-3 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-white/5">
              <div className="col-span-2 text-center">Rank</div>
              <div className="col-span-7">User</div>
              <div className="col-span-3 text-right">Poin</div>
            </div>

            {/* Baris Data */}
            {data.map((item, index) => {
              const isMe = address && item.user_address.toLowerCase() === address.toLowerCase();
              const rank = index + 1;
              
              // Warna khusus untuk Top 3
              let rankColor = "text-gray-400";
              if (rank === 1) rankColor = "text-yellow-400 font-bold";
              if (rank === 2) rankColor = "text-gray-300 font-bold";
              if (rank === 3) rankColor = "text-orange-400 font-bold";

              return (
                <div 
                  key={item.user_address} 
                  className={`grid grid-cols-12 gap-2 p-3 items-center text-sm hover:bg-white/5 transition-colors ${
                    isMe ? "bg-blue-500/20 border-l-2 border-blue-500" : ""
                  }`}
                >
                  {/* Rank */}
                  <div className={`col-span-2 text-center ${rankColor}`}>
                    {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
                  </div>

                  {/* Address */}
                  <div className="col-span-7 font-mono text-gray-200 truncate">
                    {isMe ? (
                      <span className="text-blue-400 font-semibold">YOU</span>
                    ) : (
                      shortenAddress(item.user_address)
                    )}
                  </div>

                  {/* Poin */}
                  <div className="col-span-3 text-right font-medium text-white">
                    {item.daily_score} <span className="text-xs text-gray-500">XP</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Footer Info */}
      <div className="mt-3 text-center">
        <p className="text-[10px] text-gray-500">
          *1 Poin per Claim/Spin. Spin tersedia setiap 8 jam.
        </p>
      </div>
    </div>
  );
}
