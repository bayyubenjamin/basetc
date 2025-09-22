"use client";
import { FC } from "react";
import Image from 'next/image';
import type { Nft, TabName } from "../page";

// Tipe dan Konfigurasi
type NftTier = "Basic" | "Pro" | "Legend";
const TIER_CONFIG: Record<NftTier, { maxSlots: number; img: string }> = {
  Basic: { maxSlots: 10, img: "/img/vga_basic.png" },
  Pro: { maxSlots: 5, img: "/img/vga_pro.png" },
  Legend: { maxSlots: 3, img: "/img/vga_legend.png" },
};

interface RakitProps {
  inventory: Nft[];
  setActiveTab: (tab: TabName) => void;
}

// Komponen Slot Kosong
const EmptySlot: FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="aspect-square bg-black/20 rounded-lg border-2 border-dashed border-[var(--edge)] flex items-center justify-center text-[var(--muted)] hover:border-[var(--accent)] hover:bg-[var(--edge)] transition-colors"
  >
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  </button>
);

// Komponen Kartu NFT
const NftCard: FC<{ nft: Nft }> = ({ nft }) => (
  <div className="relative aspect-square bg-black/20 rounded-lg overflow-hidden border border-[var(--edge)] group">
    <Image src={nft.img} alt={nft.name} width={100} height={100} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
    <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent text-center">
      <p className="text-xs font-bold text-white truncate">{nft.tier}</p>
    </div>
  </div>
);

// Komponen Utama Rakit
export default function Rakit({ inventory, setActiveTab }: RakitProps) {
  const tiers: NftTier[] = ["Basic", "Pro", "Legend"];
  
  // Dummy data untuk demonstrasi
  const demoInventory: Nft[] = [
      { id: 1, tier: 'Basic', name: 'Basic Rig #1', img: '/img/vga_basic.png', durability: 100 },
      { id: 2, tier: 'Basic', name: 'Basic Rig #2', img: '/img/vga_basic.png', durability: 100 },
      { id: 3, tier: 'Pro', name: 'Pro Rig #1', img: '/img/vga_pro.png', durability: 100 },
  ];

  return (
    <div className="flex flex-col gap-3">
      {tiers.map(tier => {
        const ownedNfts = demoInventory.filter(nft => nft.tier === tier);
        const config = TIER_CONFIG[tier];
        const totalSlots = Array.from({ length: config.maxSlots });

        return (
          <section key={tier} className="panel">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold text-base">{tier} Rigs</h2>
              <p className="text-xs text-[color:var(--muted)]">{ownedNfts.length} / {config.maxSlots} Slots</p>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {ownedNfts.map(nft => <NftCard key={nft.id} nft={nft} />)}
              {totalSlots.slice(ownedNfts.length).map((_, index) => (
                <EmptySlot key={index} onClick={() => setActiveTab('market')} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
