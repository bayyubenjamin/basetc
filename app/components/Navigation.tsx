"use client";

import Image from 'next/image';
import { TabName } from '../page'; // Impor tipe dari page.tsx

// Definisikan tipe untuk props
interface NavigationProps {
  activeTab: TabName;
  setActiveTab: (tab: TabName) => void;
}

export default function Navigation({ activeTab, setActiveTab }: NavigationProps) {
  
  // Fungsi untuk menentukan style
  const getTabStyle = (tabName: TabName) => {
    return activeTab === tabName
      ? 'text-yellow-400 border-t-2 border-yellow-400'
      : 'text-gray-400 border-t-2 border-transparent';
  };

  return (
    <footer className="sticky bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700">
      <nav className="flex justify-around items-center h-16">
        <button
          onClick={() => setActiveTab('monitoring')}
          className={`flex flex-col items-center justify-center w-full pt-2 ${getTabStyle('monitoring')}`}
        >
          <Image src="/file.svg" alt="Monitoring" width={24} height={24} />
          <span className="text-xs mt-1">Monitoring</span>
        </button>
        <button
          onClick={() => setActiveTab('rakit')}
          className={`flex flex-col items-center justify-center w-full pt-2 ${getTabStyle('rakit')}`}
        >
          <Image src="/window.svg" alt="Rakit" width={24} height={24} />
          <span className="text-xs mt-1">Rakit</span>
        </button>
        <button
          onClick={() => setActiveTab('market')}
          className={`flex flex-col items-center justify-center w-full pt-2 ${getTabStyle('market')}`}
        >
          <Image src="/globe.svg" alt="Market" width={24} height={24} />
          <span className="text-xs mt-1">Market</span>
        </button>
        <button
          onClick={() => setActiveTab('profil')}
          className={`flex flex-col items-center justify-center w-full pt-2 ${getTabStyle('profil')}`}
        >
          {/* Ganti dengan ikon profil jika ada */}
          <Image src="/file.svg" alt="Profil" width={24} height={24} /> 
          <span className="text-xs mt-1">Profil</span>
        </button>
      </nav>
    </footer>
  );
}
