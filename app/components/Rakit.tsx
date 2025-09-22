"use client";
import { useState, FC } from "react";
import Image from 'next/image';
import { TabName, Nft } from "../page";

// --- Types & Config ---
type NftTier = "Basic" | "Pro" | "Legend";
const TIER_CONFIG: Record<NftTier, { maxSlots: number, img: string }> = {
  Basic: { maxSlots: 10, img: "/img/vga_basic.png" },
  Pro: { maxSlots: 5, img: "/img/vga_pro.png" },
  Legend: { maxSlots: 3, img: "/img/vga_legend.png" },
};

// --- Props ---
interface RakitProps {
    inventory: Nft[];
    setActiveTab: (tab: TabName) => void;
}

// --- Helper Components ---
const Icon: FC<{ path: string; className?: string }> = ({ path, className = "w-5 h-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
);

// --- UI Components ---
const NftCard: FC<{ nft: Nft }> = ({ nft }) => (
  <div className="relative aspect-square bg-[--background-secondary] rounded-md border border-[--border-primary] overflow-hidden group">
    <Image src={nft.img} alt={nft.name} layout="fill" objectFit="cover" className="group-hover:scale-105 transition-transform duration-300"/>
    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
        <p className="text-xs font-bold text-white truncate">{nft.name}</p>
        <div className="w-full bg-gray-600/50 rounded-full h-1 mt-1">
            <div className="bg-green-500 h-1 rounded-full" style={{ width: `${nft.durability}%` }}></div>
        </div>
    </div>
  </div>
);

const EmptySlot: FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="aspect-square flex flex-col items-center justify-center bg-white/5 rounded-md border-2 border-dashed border-[--border-primary] text-[--text-secondary] hover:bg-[--background-tertiary] hover:border-[--accent-blue] transition-colors"
  >
    <Icon path="M12 4.5v15m7.5-7.5h-15" className="w-8 h-8 opacity-50"/>
    <span className="text-xs mt-1">Add Rig</span>
  </button>
);

const TierSection: FC<{
  tier: NftTier;
  ownedNfts: Nft[];
  config: { maxSlots: number };
  onAddClick: () => void;
}> = ({ tier, ownedNfts, config, onAddClick }) => {
  const slots = Array.from({ length: config.maxSlots });

  return (
    <div className="bg-[--background-secondary] p-4 rounded-lg border border-[--border-primary]">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-bold">{tier} Rigs</h2>
        <span className="text-sm font-medium text-[--text-secondary]">
          {ownedNfts.length} / {config.maxSlots} Slots
        </span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
        {ownedNfts.map(nft => <NftCard key={nft.id} nft={nft} />)}
        {slots.slice(ownedNfts.length).map((_, index) => <EmptySlot key={index} onClick={onAddClick} />)}
      </div>
    </div>
  );
};


// --- Main Component ---
export default function Rakit({ inventory, setActiveTab }: RakitProps) {
  const Tiers: NftTier[] = ["Basic", "Pro", "Legend"];

  return (
    <div className="p-4 space-y-5 animate-fadeInUp">
       <header className="flex items-center gap-3">
            <Icon path="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.438.995s.145.755.438.995l1.003.827c.481.398.668 1.04.26 1.431l-1.296 2.247a1.125 1.125 0 01-1.37.49l-1.217-.456c-.355-.133-.75-.072-1.075.124a6.57 6.57 0 01-.22.127c-.332.183-.582.495-.645.87l-.213 1.281c-.09.543-.56.94-1.11.94h-2.593c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.063-.374-.313-.686-.645-.87a6.52 6.52 0 01-.22-.127c-.324-.196-.72-.257-1.075-.124l-1.217.456a1.125 1.125 0 01-1.37-.49l-1.296-2.247a1.125 1.125 0 01.26-1.431l1.003-.827c.293-.24.438-.613-.438.995s-.145-.755-.438-.995l-1.003-.827a1.125 1.125 0 01-.26-1.431l1.296-2.247a1.125 1.125 0 011.37-.49l1.217.456c.355.133.75.072 1.075-.124.073-.044.146-.087.22-.127.332-.183.582-.495-.645-.87l.213-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z" className="w-8 h-8 text-[--accent-blue]" />
            <div>
                <h1 className="text-xl font-bold leading-tight">Rigs Workshop</h1>
                <p className="text-xs text-[--text-secondary]">Manage your mining rigs and slots.</p>
            </div>
        </header>
      {Tiers.map(tier => (
        <TierSection
          key={tier}
          tier={tier}
          ownedNfts={inventory.filter(nft => nft.tier === tier)}
          config={TIER_CONFIG[tier]}
          onAddClick={() => setActiveTab('market')}
        />
      ))}
    </div>
  );
}
