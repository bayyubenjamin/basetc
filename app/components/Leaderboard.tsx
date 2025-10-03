// app/components/Leaderboard.tsx
"use client";

import { useState, useEffect, type FC } from "react";
import Image from "next/image";

// Tipe data ini sudah sesuai dengan apa yang dikirim oleh
// Supabase view (termasuk 'rank' yang sudah berurutan).
type LeaderboardEntry = {
  rank: number;
  fid: number;
  display_name: string | null;
  username: string | null;
  pfp_url: string | null;
  total_points: number;
};

const Leaderboard: FC = () => {
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/leaderboard");
        if (!response.ok) {
          throw new Error("Failed to fetch leaderboard data.");
        }
        const data = await response.json();
        // Data 'data.items' yang diterima dari API sudah memiliki
        // peringkat yang berurutan (1, 2, 3, ...) berkat
        // ROW_NUMBER() di Supabase view.
        setLeaderboardData(data.items);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  return (
    <div className="space-y-4 rounded-lg bg-neutral-900/50 p-4 border border-neutral-700">
      <h2 className="text-lg font-semibold text-center">Leaderboard</h2>
      <p className="text-sm text-neutral-400 text-center">Peringkat poin untuk ronde saat ini.</p>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-neutral-400">
            <tr>
              <th className="px-4 py-2 text-left">Rank</th>
              <th className="px-4 py-2 text-left">User</th>
              <th className="px-4 py-2 text-right">Points</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={3} className="text-center py-4 text-neutral-500">
                  Loading...
                </td>
              </tr>
            )}
            {error && (
              <tr>
                <td colSpan={3} className="text-center py-4 text-red-400">
                  {error}
                </td>
              </tr>
            )}
            {!loading &&
              !error &&
              leaderboardData.map((entry) => (
                <tr key={entry.fid} className="border-b border-neutral-800 hover:bg-neutral-800/50">
                  {/* Bagian ini hanya menampilkan 'entry.rank' yang sudah benar */}
                  {/* dari backend. Tidak perlu logika tambahan di sini. */}
                  <td className="px-4 py-2 font-medium">{entry.rank}</td>
                  <td className="px-4 py-2 flex items-center gap-3">
                    {entry.pfp_url ? (
                      <Image
                        src={entry.pfp_url}
                        alt={entry.display_name || ""}
                        width={24}
                        height={24}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-neutral-700" />
                    )}
                    <span className="font-semibold">{entry.display_name || `@${entry.username}` || `FID: ${entry.fid}`}</span>
                  </td>
                  <td className="px-4 py-2 text-right font-semibold">
                    {entry.total_points}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Leaderboard;

