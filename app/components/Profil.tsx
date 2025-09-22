"use client";
import { useState, FC } from "react";
import Image from 'next/image';

// --- Types & Data (can be replaced with real data) ---
type UserTier = "Beginner" | "Pro" | "Legend" | "Supreme";
interface Achievement { name: string; icon: string; }
interface UserProfile {
  username: string;
  pfp: string;
  walletAddress: string;
  tier: UserTier;
  stats: { baseTcBalance: number; totalHashrate: number; nftCount: number; referrals: number };
  achievements: Achievement[];
}

const dummyUser: UserProfile = {
  username: "@bayu.eth",
  pfp: "/img/logo.png",
  walletAddress: "0x1A2b3c4d5E6f7A8b9C0d1E2f3A4b5C6d7E8f9A0b",
  tier: "Pro",
  stats: { baseTcBalance: 12345.67, totalHashrate: 170.7, nftCount: 10, referrals: 2 },
  achievements: [
    { name: "Early Miner", icon: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" },
    { name: "Pro Upgrader", icon: "M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-3.75-2.25M21 18l-3.75-2.25" },
    { name: "First Merge", icon: "M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.362-3.797z" },
  ],
};

// --- Helper Components ---
const Icon: FC<{ path: string; className?: string }> = ({ path, className = "w-5 h-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
);
const Toast: FC<{ message: string }> = ({ message }) => (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-lg animate-fadeInUp z-50">
        {message}
    </div>
);
const StatCard: FC<{ title: string; value: string | number; iconPath: string; }> = ({ title, value, iconPath }) => (
  <div className="bg-[--background-secondary] p-3 rounded-lg border border-[--border-primary] text-center">
    <Icon path={iconPath} className="w-6 h-6 mx-auto text-[--accent-blue] mb-1"/>
    <p className="text-xl font-bold">{value}</p>
    <p className="text-xs text-[--text-secondary]">{title}</p>
  </div>
);
const AchievementBadge: FC<{ achievement: Achievement }> = ({ achievement }) => (
  <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-[--background-secondary] border border-[--border-primary]">
    <div className="w-10 h-10 flex items-center justify-center rounded-full bg-yellow-900/50 text-yellow-400 mb-2 border-2 border-yellow-500/50">
      <Icon path={achievement.icon} className="w-6 h-6"/>
    </div>
    <p className="text-[11px] font-semibold text-center">{achievement.name}</p>
  </div>
);

// --- Main Component ---
export default function Profil() {
    const [user] = useState<UserProfile>(dummyUser);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    
    const showToast = (message: string) => {
        setToastMessage(message);
        setTimeout(() => setToastMessage(null), 3000);
    };

    const handleCopy = (text: string, subject: string) => {
        navigator.clipboard.writeText(text);
        showToast(`${subject} copied!`);
    };

    const TIER_STYLES: Record<UserTier, string> = {
        Beginner: "bg-gray-500 border-gray-400",
        Pro: "bg-cyan-500 border-cyan-400",
        Legend: "bg-purple-600 border-purple-500",
        Supreme: "bg-yellow-500 border-yellow-400",
    };

    return (
        <div className="p-4 space-y-5 animate-fadeInUp">
            {toastMessage && <Toast message={toastMessage} />}

            {/* Profile Header */}
            <div className="flex flex-col items-center text-center">
                <Image src={user.pfp} alt="Profile" width={80} height={80} className="rounded-full border-4 border-purple-500/50 shadow-lg" />
                <h1 className="text-2xl font-bold mt-3">{user.username}</h1>
                <div className={`mt-1 px-3 py-1 text-xs font-bold rounded-full text-white ${TIER_STYLES[user.tier]}`}>
                    {user.tier} Miner
                </div>
                <button
                    onClick={() => handleCopy(user.walletAddress, 'Address')}
                    className="mt-2 flex items-center gap-1.5 text-xs text-[--text-secondary] bg-[--background-tertiary] px-2 py-1 rounded-md hover:bg-opacity-80"
                >
                    <span>{`${user.walletAddress.substring(0, 6)}...${user.walletAddress.substring(user.walletAddress.length - 4)}`}</span>
                    <Icon path="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0015 2.25h-1.5a2.251 2.251 0 00-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6v-.75c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H12m0 0a3 3 0 013 3v3h-6v-3a3 3 0 013-3z" className="w-3 h-3" />
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
                <StatCard title="$BaseTC Balance" value={user.stats.baseTcBalance.toLocaleString()} iconPath="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9A2.25 2.25 0 0018.75 6.75h-1.5a3 3 0 10-6 0h-1.5A2.25 2.25 0 003 9v3m18 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                <StatCard title="Total Hashrate" value={`${user.stats.totalHashrate.toFixed(1)} H/s`} iconPath="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                <StatCard title="NFTs Owned" value={user.stats.nftCount} iconPath="M2.25 7.125A3.375 3.375 0 006 3.75h12A3.375 3.375 0 0018 7.125v10.5a3.375 3.375 0 00-3.375 3.375h-1.5A1.125 1.125 0 0112 19.5v-1.5a1.125 1.125 0 01-1.125-1.125H9.75A3.375 3.375 0 006 17.625v-10.5z" />
                <StatCard title="Referrals" value={user.stats.referrals} iconPath="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m-7.5-2.962a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM3.375 19.5a3 3 0 013-3h1.5m0 0a3.75 3.75 0 017.5 0" />
            </div>

            {/* Achievements */}
            <div>
              <h2 className="text-lg font-bold mb-2">Achievements</h2>
              <div className="grid grid-cols-4 gap-3">
                {user.achievements.map(ach => <AchievementBadge key={ach.name} achievement={ach} />)}
              </div>
            </div>
        </div>
    );
}
