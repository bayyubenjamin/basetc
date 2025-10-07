"use client";

import { useState, useEffect, type FC, useMemo } from "react";
import Image from "next/image";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatEther } from "viem";
import { base, baseSepolia } from "viem/chains"; // <— tambahkan ini
import { fetchCurrentSnapshot, type Snapshot } from "../utils/snapshot";
import { VAULT_ADDRESS, vaultABI } from "../lib/vault";

// === pilih chain TX ===
// - pakai base untuk mainnet
// - pakai baseSepolia untuk testnet
const TX_CHAIN = baseSepolia;

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

  // ====== Snapshot & Wallet ======
  const { address } = useAccount();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [claiming, setClaiming] = useState(false);

  // Fetch leaderboard
  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/leaderboard");
        if (!response.ok) throw new Error("Failed to fetch leaderboard data.");
        const data = await response.json();
        setLeaderboardData(data.items);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, []);

  // Fetch snapshot
  useEffect(() => {
    fetchCurrentSnapshot().then(setSnap);
  }, []);

  // Entitlement user dari JSON
  const entitlement = useMemo(() => {
    if (!snap || !address) return null;
    return snap.entries[(address.toLowerCase() as `0x${string}`)] || null;
  }, [snap, address]);

  // Status claimed on-chain
  const { data: isClaimed } = useReadContract({
    abi: vaultABI,
    address: VAULT_ADDRESS,
    functionName: "claimed",
    args: [
      BigInt(snap?.snapshotId || 0),
      (address ??
        "0x0000000000000000000000000000000000000000") as `0x${string}`,
    ],
    // beberapa versi wagmi tidak butuh query.enabled — biarkan default
  });

  // Write claim
  const { data: txHash, writeContract, isPending } = useWriteContract();
  const { isLoading: txLoading, isSuccess: txSuccess } =
    useWaitForTransactionReceipt({ hash: txHash });

  const onClaim = async () => {
    if (!snap || !entitlement || !address) return;
    try {
      setClaiming(true);
      await writeContract({
        // ====== FIX INTI: sertakan chain & account ======
        chain: TX_CHAIN,
        account: address as `0x${string}`,
        abi: vaultABI,
        address: VAULT_ADDRESS,
        functionName: "claim",
        args: [
          BigInt(snap.snapshotId),
          BigInt(entitlement.amount),
          entitlement.proof,
        ],
      });
    } finally {
      setClaiming(false);
    }
  };

  const claimDisabled =
    !snap ||
    !address ||
    !entitlement ||
    entitlement.amount === "0" ||
    isPending ||
    txLoading ||
    Boolean(isClaimed);

  return (
    <div className="relative">
      {/* OVERLAY SOON */}
      <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-black/40 backdrop-blur-sm">
        <span className="text-4xl md:text-5xl font-extrabold tracking-widest text-white/90 drop-shadow">
          SOON!
        </span>
      </div>

      {/* ASLI (DIBIARKAN, HANYA DIBUAT BLUR & NON-INTERAKTIF) */}
      <div className="blur-sm select-none pointer-events-none">
        <div className="space-y-4 rounded-lg bg-neutral-900/50 p-4 border border-neutral-700">
          <h2 className="text-lg font-semibold text-center">Leaderboard</h2>
          <p className="text-sm text-neutral-400 text-center">
            Peringkat poin untuk ronde saat ini.
          </p>

          {/* ====== Halving Reward box ====== */}
          <div className="rounded-md border border-neutral-700 bg-neutral-800/50 p-3 flex items-center justify-between gap-3">
            <div className="text-sm">
              <div className="font-semibold">Halving Reward</div>
              {snap ? (
                <div className="text-neutral-300">
                  Snapshot #{snap.snapshotId}{" "}
                  {isClaimed
                    ? "• ✅ Claimed"
                    : entitlement
                    ? "• Eligible"
                    : "• Not eligible"}
                </div>
              ) : (
                <div className="text-neutral-400">No active snapshot</div>
              )}
              {entitlement && (
                <div className="text-xs text-neutral-400">
                  Your allocation: {formatEther(BigInt(entitlement.amount))} $BaseTC
                </div>
              )}
            </div>

            <button
              onClick={onClaim}
              disabled={claimDisabled}
              className="px-3 py-2 rounded-md bg-white/10 hover:bg-white/15 disabled:opacity-50 text-sm"
            >
              {isPending || txLoading || claiming
                ? "Claiming..."
                : isClaimed
                ? "Claimed"
                : "Claim"}
            </button>
          </div>

          {/* ====== Tabel leaderboard ====== */}
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
                    <tr
                      key={entry.fid}
                      className="border-b border-neutral-800 hover:bg-neutral-800/50"
                    >
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
                        <span className="font-semibold">
                          {entry.display_name ||
                            `@${entry.username}` ||
                            `FID: ${entry.fid}`}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-semibold">
                        {entry.total_points}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* feedback tx */}
          {txSuccess && (
            <p className="text-green-400 text-xs">Claim success. 🎉</p>
          )}
          {isClaimed && (
            <p className="text-neutral-400 text-xs">
              You have already claimed for this snapshot.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;

