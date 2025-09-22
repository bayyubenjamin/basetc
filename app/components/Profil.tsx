"use client";
import { FC } from 'react';
import Image from 'next/image';

// Types & Dummy Data
interface Achievement { name: string; icon: string; }
const dummyAchievements: Achievement[] = [
  { name: "Early Miner", icon: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" },
  { name: "Pro Upgrader", icon: "M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-3.75-2.25M21 18l-3.75-2.25" },
  { name: "First Merge", icon: "M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.362-3.797z" },
  { name: "Network Pro", icon: "M10.5 6a7.5 7.5 0 100 15 7.5 7.5 0 000-15zM2.25 9h19.5" }
];
const dummyUser = {
  pfp: "/img/logo.png", // Ganti dengan pfp pengguna
  username: "bayu.eth",
  walletAddress: "0x1A2b...f9A0b",
};

// Helper Components
const Icon: FC<{ path: string; className?: string; }> = ({ path, className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

const StatCard: FC<{ title: string; value: string; }> = ({ title, value }) => (
  <div className="bg-gradient-to-b from-[#08141b] to-[#061018] p-2.5 rounded-lg border border-[#122b3c] text-center">
    <p className="text-xl font-bold">{value}</p>
    <p className="text-xs text-[color:var(--muted)]">{title}</p>
  </div>
);

const AchievementBadge: FC<{ ach: Achievement }> = ({ ach }) => (
  <div className="flex flex-col items-center justify-center text-center gap-1.5">
    <div className="w-12 h-12 flex items-center justify-center rounded-full bg-[#061018] border border-[#223146] text-[var(--accent)]">
      <Icon path={ach.icon} className="w-6 h-6" />
    </div>
    <p className="text-[10px] font-semibold text-[color:var(--muted)] leading-tight">{ach.name}</p>
  </div>
);

// Main Component
export default function Profil() {
  return (
    <div className="flex flex-col gap-3">
      {/* User Info Panel */}
      <div className="panel flex items-center gap-4">
        <Image src={dummyUser.pfp} alt="Profile Picture" width={64} height={64} className="rounded-full border-2 border-[var(--accent2)]" />
        <div>
          <h2 className="text-lg font-bold">{dummyUser.username}</h2>
          <p className="text-xs text-[color:var(--muted)]">{dummyUser.walletAddress}</p>
        </div>
      </div>

      {/* Stats Panel */}
      <div className="panel">
        <h3 className="font-bold mb-3">Statistics</h3>
        <div className="grid grid-cols-2 gap-2">
          <StatCard title="Total Hashrate" value="2.15 H/s" />
          <StatCard title="NFTs Owned" value="3" />
          <StatCard title="Total Earned" value="15,230" />
          <StatCard title="Referrals" value="2" />
        </div>
      </div>

      {/* Achievements Panel */}
      <div className="panel">
        <h3 className="font-bold mb-3">Achievements</h3>
        <div className="grid grid-cols-4 gap-2">
          {dummyAchievements.map(ach => <AchievementBadge key={ach.name} ach={ach} />)}
        </div>
      </div>
    </div>
  );
}
