"use client";
import { FC } from 'react';
import Image from 'next/image';

// Tipe dan Data
type TierID = 'basic' | 'pro' | 'legend';
interface NFTTier {
  id: TierID;
  name: string;
  image: string;
  hashrateHint: string;
  price: string;
  description: string;
}

const NFT_DATA: NFTTier[] = [
  { id: 'basic', name: 'Basic Rig', image: '/img/vga_basic.png', hashrateHint: '~1.5 H/s', price: 'FREE', description: 'Claim your first rig for free to start mining.' },
  { id: 'pro', name: 'Pro Rig', image: '/img/vga_pro.png', hashrateHint: '~5.0 H/s', price: 'TBA', description: 'Upgrade for a significant boost in hashrate.' },
  { id: 'legend', name: 'Legend Rig', image: '/img/vga_legend.png', hashrateHint: '~25.0 H/s', price: 'TBA', description: 'The ultimate rig for professional miners.' },
];

interface MarketProps {
  onTransactionSuccess: () => void;
}

// Kartu Tier
const TierCard: FC<{ tier: NFTTier }> = ({ tier }) => (
  <div className="panel flex flex-col overflow-hidden">
    <div className="bg-[#06101a] border border-[#223146] rounded-lg overflow-hidden">
        <Image src={tier.image} alt={tier.name} width={400} height={200} className="w-full h-auto" />
    </div>
    <div className="flex flex-col flex-grow p-1.5 pt-3">
        <div className="flex justify-between items-start">
            <h3 className="text-lg font-bold">{tier.name}</h3>
            <span className="text-sm font-bold bg-[var(--edge)] px-3 py-1 rounded-full text-[var(--accent)]">{tier.price}</span>
        </div>
        <p className="text-xs text-[color:var(--muted)] mt-1 flex-grow">{tier.description}</p>
        <div className="text-xs text-[color:var(--muted)] mt-3 space-y-1 border-t border-dashed border-white/5 pt-3">
            <p className="flex justify-between">Est. Hashrate: <span className="font-semibold text-[color:var(--text)]">{tier.hashrateHint}</span></p>
        </div>
        <button
            disabled={tier.id !== 'basic'} // Contoh: hanya basic yang bisa di-claim
            className="btn btn-primary w-full mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {tier.id === 'basic' ? 'Claim Free Rig' : 'Coming Soon'}
        </button>
    </div>
  </div>
);

// Komponen Utama Market
export default function Market({ onTransactionSuccess }: MarketProps) {
  return (
    <div className="flex flex-col gap-4">
       {NFT_DATA.map((tier) => (
          <TierCard key={tier.id} tier={tier} />
       ))}
    </div>
  );
}
