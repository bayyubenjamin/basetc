"use client";

import type { FC } from 'react';
import Image from 'next/image';

// Achievement type and dummy data
interface Achievement {
  name: string;
  icon: string;
}

const dummyAchievements: Achievement[] = [
  { name: 'Early Miner', icon: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z' },
  { name: 'Pro Upgrader', icon: 'M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-3.75-2.25M21 18l-3.75-2.25' },
  { name: 'First Merge', icon: 'M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.362-3.797z' },
  { name: 'Network Pro', icon: 'M10.5 6a7.5 7.5 0 100 15 7.5 7.5 0 000-15zM2.25 9h19.5' },
];

const dummyUser = {
  pfp: '/img/logo.png', // Replace with user avatar
  username: 'bayu.eth',
  walletAddress: '0x1A2b...f9A0b',
  rigsOwned: 9,
  totalHashrate: '42 GH/s',
  totalRewards: '987 $BaseTC',
};

const Icon: FC<{ path: string; className?: string }> = ({ path, className = 'w-5 h-5' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
    className={className}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

const StatCard: FC<{ title: string; value: string }> = ({ title, value }) => (
  <div className="flex-1 bg-neutral-800 rounded-lg p-3 text-center text-xs md:text-sm">
    <div className="text-lg font-semibold">{value}</div>
    <div className="text-neutral-400">{title}</div>
  </div>
);

const AchievementBadge: FC<{ ach: Achievement }> = ({ ach }) => (
  <div className="flex items-center space-x-1 bg-neutral-800 rounded-md px-2 py-1 text-xs">
    <Icon path={ach.icon} className="w-4 h-4 text-yellow-400" />
    <span>{ach.name}</span>
  </div>
);

/**
 * Profile page shows user details, overall mining statistics, and unlocked
 * achievements. This component uses dummy data; integrate with Supabase
 * or Farcaster identity to fetch real user information.
 */
export default function Profil() {
  return (
    <div className="space-y-4 px-4 pt-4 pb-8">
      {/* User Info Panel */}
      <div className="flex items-center space-x-3 bg-neutral-800 rounded-lg p-3">
        <div className="w-12 h-12 bg-neutral-700 rounded-full flex items-center justify-center overflow-hidden">
          {/* Replace with <Image src={dummyUser.pfp} …/> once images are available */}
          <span className="text-xs text-neutral-400">PFP</span>
        </div>
        <div>
          <div className="font-semibold text-sm md:text-base">{dummyUser.username}</div>
          <div className="text-xs md:text-sm text-neutral-400">{dummyUser.walletAddress}</div>
        </div>
      </div>

      {/* Stats Panel */}
      <div className="bg-neutral-800 rounded-lg p-3 space-y-3">
        <h2 className="font-semibold text-sm md:text-base">Statistics</h2>
        <div className="flex space-x-2">
          <StatCard title="Rigs Owned" value={dummyUser.rigsOwned.toString()} />
          <StatCard title="Total Hashrate" value={dummyUser.totalHashrate} />
          <StatCard title="Total Rewards" value={dummyUser.totalRewards} />
        </div>
      </div>

      {/* Achievements Panel */}
      <div className="bg-neutral-800 rounded-lg p-3 space-y-2">
        <h2 className="font-semibold text-sm md:text-base">Achievements</h2>
        <div className="flex flex-wrap gap-2">
          {dummyAchievements.map((ach) => (
            <AchievementBadge key={ach.name} ach={ach} />
          ))}
        </div>
      </div>
    </div>
  );
}