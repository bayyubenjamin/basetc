"use client";

import { useState } from 'react';
import Image from 'next/image';
import Monitoring from './components/Monitoring';
import Navigation from './components/Navigation';
import Rakit from './components/Rakit';
import Market from './components/Market';
import Profil from './components/Profil';

// Tipe untuk nama tab
export type TabName = 'monitoring' | 'rakit' | 'market' | 'profil';

// Tipe untuk NFT, agar bisa dibagikan
export interface Nft {
  id: number;
  tier: "Basic" | "Pro" | "Legend";
  name: string;
  img: string;
  durability: number;
}

// Data awal inventaris
const initialInventory: Nft[] = [
  ...Array.from({ length: 4 }, (_, i) => ({ id: 100 + i, tier: "Basic" as const, name: `Basic Rig #${i+1}`, img: "/img/vga_basic.png", durability: Math.floor(Math.random() * 30) + 70 })),
  ...Array.from({ length: 1 }, (_, i) => ({ id: 200 + i, tier: "Pro" as const, name: `Pro Rig #${i+1}`, img: "/img/vga_pro.png", durability: Math.floor(Math.random() * 20) + 80 })),
];


export default function Home() {
  const [activeTab, setActiveTab] = useState<TabName>('monitoring');
  
  // State untuk inventaris dan status mining sekarang ada di sini
  const [inventory, setInventory] = useState<Nft[]>(initialInventory);
  const [mining, setMining] = useState(true);

  const renderContent = () => {
    switch (activeTab) {
      case 'monitoring':
        // Kirim data inventory dan status mining ke Monitoring
        return <Monitoring inventory={inventory} mining={mining} setMining={setMining} />;
      case 'rakit':
        // Kirim data inventory dan fungsi update-nya ke Rakit
        return <Rakit inventory={inventory} setInventory={setInventory} setActiveTab={setActiveTab} />;
      case 'market':
        return <Market />;
      case 'profil':
        return <Profil />;
      default:
        return <Monitoring inventory={inventory} mining={mining} setMining={setMining} />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white">
      <header className="sticky top-0 left-0 right-0 bg-gray-800 p-4 flex items-center justify-between border-b border-gray-700 z-10">
        <div className="flex items-center space-x-2">
          <Image src="/img/logo.png" alt="BaseTC Logo" width={32} height={32} />
          <h1 className="text-xl font-bold">BaseTC Mining</h1>
        </div>
        <div className="text-xs text-yellow-400">
          Lv. 5
        </div>
      </header>

      {renderContent()}

      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}
