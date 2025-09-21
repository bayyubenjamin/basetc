"use client";
import { useState, FC } from "react";
import Image from 'next/image';

// --- Types & Dummy Data ---

type UserTier = "Beginner" | "Pro" | "Legend" | "Supreme";

interface Achievement {
  name: string;
  icon: string; // SVG path
}

interface UserProfile {
  username: string;
  pfp: string; // profile picture url
  walletAddress: string;
  tier: UserTier;
  stats: {
    baseTcBalance: number;
    unclaimedRewards: number;
    totalHashrate: number;
    nftCount: { basic: number; pro: number; legend: number };
  };
  referral: {
    invites: number;
    url: string;
  };
  achievements: Achievement[];
}

const dummyUser: UserProfile = {
  username: "@bayu.eth",
  pfp: "/img/logo.png", // Placeholder, ideally from Farcaster
  walletAddress: "0x1A2b3c4d5E6f7A8b9C0d1E2f3A4b5C6d7E8f9A0b",
  tier: "Pro",
  stats: {
    baseTcBalance: 12345.67,
    unclaimedRewards: 150.25,
    totalHashrate: 170.7,
    nftCount: { basic: 8, pro: 2, legend: 0 },
  },
  referral: {
    invites: 2,
    url: "https://basetc.xyz/invite/bayu.eth",
  },
  achievements: [
    { name: "Early Miner", icon: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" },
    { name: "Pro Upgrader", icon: "M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-3.75-2.25M21 18l-3.75-2.25" },
    { name: "First Merge", icon: "M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.362-3.797z" },
  ],
};

// --- Helper & UI Components ---

const Icon: FC<{ path: string; className?: string }> = ({ path, className = "w-5 h-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
);

const Toast: FC<{ message: string }> = ({ message }) => (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-green-500/90 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-lg animate-fade-in-down z-50">
        {message}
    </div>
);

const StatCard: FC<{ title: string; value: string; icon: string; unit?: string }> = ({ title, value, icon, unit }) => (
    <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-3">
        <div className="flex items-center gap-2 text-sm text-gray-400">
            <Icon path={icon} className="w-4 h-4" />
            <span>{title}</span>
        </div>
        <div className="mt-1">
            <span className="text-xl font-bold text-white">{value}</span>
            {unit && <span className="text-sm text-gray-400 ml-1">{unit}</span>}
        </div>
    </div>
);

const AchievementBadge: FC<{ achievement: Achievement }> = ({ achievement }) => (
    <div className="flex flex-col items-center justify-center text-center p-2 rounded-lg border border-gray-700 bg-gray-800/50">
        <div className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-700 text-yellow-400 mb-1">
            <Icon path={achievement.icon} className="w-5 h-5" />
        </div>
        <p className="text-xs font-semibold text-gray-300">{achievement.name}</p>
    </div>
);


// --- Main Profile Component ---

export default function Profil() {
    const [user] = useState<UserProfile>(dummyUser);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    
    const showToast = (message: string) => {
        setToastMessage(message);
        setTimeout(() => setToastMessage(null), 3000);
    };

    const handleCopy = (text: string, subject: string) => {
        navigator.clipboard.writeText(text);
        showToast(`${subject} copied to clipboard!`);
    };

    const TIER_COLORS: Record<UserTier, string> = {
        Beginner: "bg-gray-500 text-white",
        Pro: "bg-cyan-500 text-white",
        Legend: "bg-purple-500 text-white",
        Supreme: "bg-yellow-400 text-black",
    };

    return (
        <div className="mx-auto max-w-[430px] px-3 pb-4 pt-3 flex-grow flex flex-col gap-4">
            {toastMessage && <Toast message={toastMessage} />}

            {/* 1. Header Profil */}
            <section className="flex items-center gap-4">
                <Image src={user.pfp} alt="Profile Picture" width={64} height={64} className="rounded-full border-2 border-purple-500" />
                <div className="flex-grow">
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-bold">{user.username}</h1>
                        <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${TIER_COLORS[user.tier]}`}>
                            {user.tier} Miner
                        </span>
                    </div>
                    <button 
                        onClick={() => handleCopy(user.walletAddress, 'Wallet address')}
                        className="flex items-center gap-1 text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded-md mt-1 hover:bg-gray-700"
                    >
                        <span>{`${user.walletAddress.substring(0, 6)}...${user.walletAddress.substring(user.walletAddress.length - 4)}`}</span>
                        <Icon path="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0015 2.25h-1.5a2.251 2.251 0 00-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6v-.75c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H12m0 0a3 3 0 013 3v3h-6v-3a3 3 0 013-3z" className="w-3 h-3" />
                    </button>
                </div>
            </section>

            {/* 2. Statistik Akun */}
            <section className="grid grid-cols-2 gap-3">
                <StatCard title="$BaseTC Balance" value={user.stats.baseTcBalance.toLocaleString()} icon="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9A2.25 2.25 0 0018.75 6.75h-1.5a3 3 0 10-6 0h-1.5A2.25 2.25 0 003 9v3m18 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                <StatCard title="Total Hashrate" value={user.stats.totalHashrate.toFixed(1)} unit="H/s" icon="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                <StatCard title="NFTs Owned" value={`${user.stats.nftCount.basic + user.stats.nftCount.pro + user.stats.nftCount.legend}`} icon="M2.25 7.125A3.375 3.375 0 006 3.75h12A3.375 3.375 0 0018 7.125v10.5a3.375 3.375 0 00-3.375 3.375h-1.5A1.125 1.125 0 0112 19.5v-1.5a1.125 1.125 0 01-1.125-1.125H9.75A3.375 3.375 0 006 17.625v-10.5z" />
                 <StatCard title="Unclaimed" value={user.stats.unclaimedRewards.toFixed(2)} unit="$BaseTC" icon="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
            </section>

            {/* 3. Panel Referral */}
            <section className="rounded-lg border border-gray-700 bg-gray-800/50 p-3">
                <div className="flex justify-between items-center mb-1">
                    <p className="text-sm font-semibold">Referral Rewards</p>
                    <p className="text-sm font-bold">{user.referral.invites}/3 to next Basic Rig</p>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                    <div className="bg-gradient-to-r from-cyan-400 to-purple-500 h-2 rounded-full" style={{ width: `${(user.referral.invites / 3) * 100}%` }}></div>
                </div>
                <button onClick={() => handleCopy(user.referral.url, 'Invite link')} className="w-full bg-gray-700 hover:bg-gray-600 text-cyan-300 font-semibold py-2 px-4 rounded-md text-sm transition-colors">
                    Copy Invite Link
                </button>
            </section>

            {/* 4. Achievements */}
            <section>
                <h2 className="text-sm font-semibold mb-2">Achievements</h2>
                <div className="grid grid-cols-4 gap-2">
                    {user.achievements.map(ach => <AchievementBadge key={ach.name} achievement={ach} />)}
                </div>
            </section>

            {/* 5. Actions */}
            <section className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-700/50">
                <button className="w-full rounded-lg py-2 text-sm font-bold transition-all duration-300 bg-green-500 text-white shadow-lg shadow-green-500/30 hover:bg-green-400">
                    Claim Rewards
                </button>
                <button className="w-full rounded-lg py-2 text-sm font-bold transition-all duration-300 bg-gray-700 text-gray-300 hover:bg-gray-600">
                    Withdraw
                </button>
            </section>
        </div>
    );
}
