"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import { useAccount } from "wagmi";

// Desain Ulang Komponen
import Monitoring from "./components/Monitoring";
import Navigation from "./components/Navigation";
import Rakit from "./components/Rakit";
import Market from "./components/Market";
import Profil from "./components/Profil";
// (Pastikan hooks dan logic koneksi wallet lainnya ditambahkan kembali jika perlu)

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
  const { isConnected } = useAccount(); // Asumsi logic koneksi sudah ada

  // Dummy data
  const [balance, setBalance] = useState("12,345");
  const [inventory, setInventory] = useState<Nft[]>([]);
  
  const renderContent = () => {
    switch (activeTab) {
      case "monitoring": return <Monitoring />;
      case "rakit": return <Rakit inventory={inventory} setActiveTab={setActiveTab} />;
      case "market": return <Market onTransactionSuccess={() => {}} />;
      case "profil": return <Profil />;
      default: return null;
    }
  };

  // Tampilan loading atau jika belum konek bisa ditambahkan di sini
  if (!isConnected) {
    return (
      <div className="flex items-center justify-center h-screen text-center">
        <p>Menghubungkan ke dompet Farcaster...</p>
      </div>
    );
  }

  return (
    <div className="app-shell">
       {/* Header Sesuai Referensi */}
       <header className="grid grid-cols-[1fr_auto] gap-2 items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-b from-[#0f1924] to-[#071017] border border-[#25344a] shadow-main" />
            <div>
              <div className="font-bold text-sm leading-none">BaseTC Mining Console</div>
              <div className="text-xs text-[color:var(--muted)]">Your Mining Dashboard</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1.5 bg-gradient-to-b from-[#0f1622] to-[#0a1119] text-xs px-2.5 py-1.5 rounded-full border border-[#233045]">
                <span className="text-[color:var(--muted)]">Balance</span>
                <strong className="text-[color:var(--text)]">{balance}</strong>
                <span className="text-[color:var(--muted)]">$BaseTC</span>
            </div>
            <button className="btn btn-primary">
              Claim
            </button>
          </div>
       </header>

      {/* Konten dinamis sesuai tab */}
      {renderContent()}

      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}
