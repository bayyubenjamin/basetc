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

export default function Home() {
  // State untuk melacak tab yang sedang aktif
  const [activeTab, setActiveTab] = useState<TabName>('rakit'); // Default ke 'rakit' untuk testing

  // Fungsi untuk merender komponen berdasarkan tab yang aktif
  const renderContent = () => {
    switch (activeTab) {
      case 'monitoring':
        return <Monitoring />;
      case 'rakit':
        // Teruskan setActiveTab sebagai prop ke Rakit
        return <Rakit setActiveTab={setActiveTab} />;
      case 'market':
        return <Market />;
      case 'profil':
        return <Profil />;
      default:
        return <Monitoring />;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white">
      {/* Header Aplikasi */}
      <header className="sticky top-0 left-0 right-0 bg-gray-800 p-4 flex items-center justify-between border-b border-gray-700 z-10">
        <div className="flex items-center space-x-2">
          <Image src="/img/logo.png" alt="BaseTC Logo" width={32} height={32} />
          <h1 className="text-xl font-bold">BaseTC Mining</h1>
        </div>
        <div className="text-xs text-yellow-400">
          Lv. 5
        </div>
      </header>

      {/* Konten Dinamis (berubah sesuai tab) */}
      {renderContent()}

      {/* Navigasi Tab */}
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}
