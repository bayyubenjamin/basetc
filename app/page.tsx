"use client";

import { useState, useEffect } from "react";
import { useAccount, useConnect } from "wagmi";
import { sdk } from "@farcaster/miniapp-sdk";

// Komponen
import Monitoring from "./components/Monitoring";
import Navigation from "./components/Navigation";
import Rakit from "./components/Rakit";
import Market from "./components/Market";
import Profil from "./components/Profil";
// Import hooks dan ABI lainnya jika diperlukan

// Tipe
export type TabName = "monitoring" | "rakit" | "market" | "profil";
export interface Nft {
  id: number;
  tier: "Basic" | "Pro" | "Legend";
  name: string;
  img: string;
  durability: number;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabName>("monitoring");
  const { isConnected, isConnecting } = useAccount();
  const { connectors, connect } = useConnect();
  
  // Dummy data untuk demonstrasi
  const [inventory, setInventory] = useState<Nft[]>([
      { id: 1, tier: 'Basic', name: 'Basic Rig #1', img: '/img/vga_basic.png', durability: 100 },
      { id: 2, tier: 'Basic', name: 'Basic Rig #2', img: '/img/vga_basic.png', durability: 100 },
      { id: 3, tier: 'Pro', name: 'Pro Rig #1', img: '/img/vga_pro.png', durability: 100 },
  ]);

  useEffect(() => {
    sdk.actions.ready();
    const farcasterConnector = connectors.find((c) => c.id === "farcaster");
    if (!isConnected && !isConnecting && farcasterConnector) {
      connect({ connector: farcasterConnector });
    }
  }, [isConnected, isConnecting, connectors, connect]);

  const renderContent = () => {
    switch (activeTab) {
      case "monitoring": return <Monitoring />;
      case "rakit": return <Rakit inventory={inventory} setActiveTab={setActiveTab} />;
      case "market": return <Market />;
      case "profil": return <Profil />;
      default: return null;
    }
  };

  if (!isConnected) {
     return (
        <div className="flex items-center justify-center h-screen text-[color:var(--muted)]">
            <p>Connecting to Farcaster Wallet...</p>
        </div>
     );
  }

  return (
    <div className="app-shell">
      {/* Header Sesuai Referensi */}
      <header className="grid grid-cols-[1fr_auto] gap-2 items-center mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-b from-[#0f1924] to-[#071017] border border-[#25344a] shadow-main" />
          <div>
            <div className="font-bold text-sm leading-none">BaseTC Mining Console</div>
            <div className="text-xs text-[color:var(--muted)]">Farcaster Mini App</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1.5 bg-gradient-to-b from-[#0f1622] to-[#0a1119] text-xs px-2.5 py-1.5 rounded-full border border-[#233045]">
            <span className="text-[color:var(--muted)]">Balance</span>
            <strong className="text-[color:var(--text)]">12,345</strong>
          </div>
          <button className="btn btn-primary">Claim</button>
        </div>
      </header>

      {/* Konten dinamis sesuai tab */}
      <main className="app-content">
        {renderContent()}
      </main>

      {/* Navigasi akan diposisikan oleh class .bottom-nav */}
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}
