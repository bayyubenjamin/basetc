"use client";

import { FC, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { ConnectKitButton } from "connectkit";

// [FIX 1] Impor tipe data dan fungsi yang sudah diperbaiki.
import { getFarcasterIds, FarcasterUser } from "../lib/farcaster";
import { calculateMaxClaims } from "../lib/inviteMath";

// Helper function untuk memotong alamat wallet agar lebih pendek.
const formatAddress = (addr?: string) => {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};

// Tipe data untuk entri di leaderboard.
type LeaderboardEntry = {
  rank: number;
  display_name: string;
  pfp_url?: string;
  valid_referrals: number;
};

// Custom hook untuk mengambil data leaderboard dari API.
// Fungsi ini tidak diubah karena sudah benar.
const useLeaderboard = () => {
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((res) => res.json())
      .then((data) => {
        setData(data.leaderboard || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return { data, loading };
};


const Profil: FC = () => {
  const { address } = useAccount();
  const { data: leaderboardData, loading: leaderboardLoading } = useLeaderboard();
  
  // [FIX 2] State management yang lebih terstruktur.
  const [fcProfile, setFcProfile] = useState<FarcasterUser | null>(null);
  const [referralStats, setReferralStats] = useState({ validReferrals: 0, claimedRewards: 0 });
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);
  const [userWallet, setUserWallet] = useState<string | undefined>(undefined);

  // [FIX 3] useEffect utama untuk mengambil semua data yang dibutuhkan.
  // Hook ini akan berjalan saat komponen pertama kali dimuat dan setiap kali
  // alamat wallet berubah (misalnya setelah user connect/disconnect).
  useEffect(() => {
    const fetchData = async () => {
      setLoadingProfile(true);

      // Ambil profil Farcaster menggunakan fungsi yang robust.
      const { userProfile } = await getFarcasterIds();
      setFcProfile(userProfile);

      // Tentukan alamat wallet yang akan digunakan. Prioritaskan dari wagmi,
      // lalu coba ambil dari database jika user sudah pernah login.
      let currentWallet = address;
      if (!currentWallet && userProfile?.fid) {
        const userRes = await fetch(`/api/user?fid=${userProfile.fid}`);
        if (userRes.ok) {
            const userData = await userRes.json();
            if(userData.wallet) currentWallet = userData.wallet;
        }
      }
      setUserWallet(currentWallet);

      // Jika ada wallet, ambil statistik referral untuk wallet tersebut.
      if (currentWallet) {
        try {
            const statsRes = await fetch(`/api/referral?inviter=${currentWallet}`);
            if (statsRes.ok) {
                const stats = await statsRes.json();
                setReferralStats(stats);
            }
        } catch (e) {
            console.warn("Could not fetch referral stats:", e);
        }
      }
      setLoadingProfile(false);
    };
    fetchData();
  }, [address]); // Bergantung pada `address` dari `useAccount`.

  const handleCopy = () => {
    if (!userWallet) return;
    const referralLink = `https://basetc.vercel.app/?ref=${userWallet}`;
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000); // Reset status setelah 2 detik
    });
  };

  // Kalkulasi jumlah klaim yang tersedia berdasarkan referral.
  const availableClaims = calculateMaxClaims(referralStats.validReferrals) - referralStats.claimedRewards;

  // Tampilan loading saat data profil sedang diambil.
  if (loadingProfile) {
    return <div className="p-4 text-center">Loading profile...</div>;
  }
  
  // Tampilan jika user tidak berada dalam konteks Farcaster.
  if (!fcProfile?.fid) {
      return (
          <div className="p-4 text-center text-neutral-400">
              <p>Could not connect to Farcaster.</p>
              <p className="text-sm">Please open this Mini App from a Farcaster client like Warpcast.</p>
          </div>
      );
  }

  // Desain dan JSX yang ada dipertahankan sepenuhnya.
  return (
    <div className="p-4 space-y-4">
      {/* Profile Card */}
      <div className="card bg-neutral-800/50 rounded-lg p-4">
        <div className="flex items-center space-x-3">
          <img
            src={fcProfile.pfpUrl || "/img/logo.png"}
            alt="pfp"
            className="w-16 h-16 rounded-full bg-neutral-700"
          />
          <div>
            <h1 className="font-bold text-lg">{fcProfile.displayName || `fid: ${fcProfile.fid}`}</h1>
            <p className="text-sm text-neutral-400">@{fcProfile.username}</p>
            <div className="text-xs text-neutral-500">FID: {fcProfile.fid}</div>
          </div>
        </div>
        <div className="mt-4">
          <ConnectKitButton.Custom>
            {({ isConnected, show, address }) => {
              return (
                <button onClick={show} className="btn w-full bg-blue-500 text-white text-sm py-2 rounded-md">
                  {isConnected ? `Connected: ${formatAddress(address)}` : "Connect Wallet"}
                </button>
              );
            }}
          </ConnectKitButton.Custom>
        </div>
      </div>

      {/* Invite Card */}
      {userWallet && (
        <div className="card bg-neutral-800/50 rounded-lg p-4">
          <h2 className="font-bold">Your Invite Link</h2>
          <p className="text-sm text-neutral-400 mt-1">
            Share this link to invite friends. You have <b>{referralStats.validReferrals} valid invites</b>.
          </p>
          <p className="text-sm text-neutral-400 mt-1">
            You have <b>{availableClaims > 0 ? availableClaims : 0} reward claims</b> available.
          </p>
          <div className="flex items-center space-x-2 mt-3">
            <input
              type="text"
              readOnly
              value={`basetc.vercel.app/?ref=${formatAddress(userWallet)}`}
              className="input bg-neutral-900 text-neutral-300 w-full text-sm p-2 rounded-md flex-1"
            />
            <button onClick={handleCopy} className="btn bg-green-500 text-white text-sm px-4 py-2 rounded-md">
              {copySuccess ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {/* Leaderboard Card */}
      <div className="card bg-neutral-800/50 rounded-lg p-4">
        <h2 className="font-bold">Invite Leaderboard</h2>
        <div className="mt-3 text-sm">
          {leaderboardLoading ? (
            <p>Loading leaderboard...</p>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-neutral-700 text-neutral-400">
                  <th className="p-2">#</th>
                  <th className="p-2">User</th>
                  <th className="p-2 text-right">Invites</th>
                </tr>
              </thead>
              <tbody>
                {leaderboardData.map((p) => (
                  <tr key={p.rank} className="border-b border-neutral-800">
                    <td className="p-2">{p.rank}</td>
                    <td className="p-2 flex items-center space-x-2">
                      <img src={p.pfp_url || '/img/logo.png'} className="w-6 h-6 rounded-full bg-neutral-700" alt="pfp" />
                      <span>{p.display_name}</span>
                    </td>
                    <td className="p-2 text-right font-mono">{p.valid_referrals}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profil;

