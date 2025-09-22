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

  // FIX: Mengirim prop yang dibutuhkan oleh komponen anak
  const renderContent = () => {
    switch (activeTab) {
      case "monitoring": return <Monitoring />;
      case "rakit": return <Rakit inventory={inventory} setActiveTab={setActiveTab} />;
      case "market": return <Market onTransactionSuccess={() => console.log("Transaction Success!")} />;
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
    <div className="max-w-[430px] mx-auto min-h-dvh flex flex-col">
      <header className="p-3 grid grid-cols-[1fr_auto] gap-2 items-center">
        <div className="flex items-center gap-2.5">
          {/* Logo block now uses a predefined class for its gradient and border */}
          <div className="logo" />
          <div>
            <div className="font-bold text-sm leading-none">BaseTC Mining Console</div>
            <div className="text-xs text-[var(--muted)]">Farcaster Mini App</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Balance pill uses the .pill class and displays muted and text colours */}
          <div className="pill flex items-center gap-1.5">
            <span className="text-[var(--muted)]">Balance</span>
            <strong className="text-[var(--text)]">12,345</strong>
          </div>
          <button className="btn btn-primary">Claim</button>
        </div>
      </header>

      <main className="px-3 pb-3 flex-grow flex flex-col gap-3">
        {renderContent()}
      </main>

      {/* Navigasi sekarang berada di luar main content */}
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}
