// app/components/Leaderboard.tsx
"use client";

import { useState, useEffect, type FC } from "react";

type LeaderboardEntry = {
  rank: number;
  referrer_fid: number;
  count: number;
  // You can add more fields like username, pfp_url if your API provides them
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
        // Add rank to the data
        const rankedData = data.items.map((item: any, index: number) => ({
          ...item,
          rank: index + 1,
        }));
        setLeaderboardData(rankedData);
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
      <h2 className="text-lg font-semibold text-center">Referral Leaderboard</h2>
      <p className="text-sm text-neutral-400 text-center">Top 50 referrers this week.</p>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-neutral-400">
            <tr>
              <th className="px-4 py-2 text-left">Rank</th>
              <th className="px-4 py-2 text-left">Farcaster FID</th>
              <th className="px-4 py-2 text-right">Invites</th>
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
                <tr key={entry.rank} className="border-b border-neutral-800">
                  <td className="px-4 py-2 font-medium">{entry.rank}</td>
                  <td className="px-4 py-2">{entry.referrer_fid}</td>
                  <td className="px-4 py-2 text-right font-semibold">
                    {entry.count}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Leaderboard; // <-- TAMBAHKAN BARIS INI
