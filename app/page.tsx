"use client";

import { useState, useEffect } from "react";
import { useAccount, useConnect } from "wagmi";
import { sdk } from "@farcaster/miniapp-sdk";

import Monitoring from "./components/Monitoring";
import Navigation from "./components/Navigation";
import Rakit from "./components/Rakit";
import Market from "./components/Market";
import Profil from "./components/Profil";

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

  // demo inventory
  const [inventory] = useState<Nft[]>([
    { id: 1, tier: "Basic", name: "Basic Rig #1", img: "/img/vga_basic.png", durability: 100 },
    { id: 2, tier: "Basic", name: "Basic Rig #2", img: "/img/vga_basic.png", durability: 100 },
    { id: 3, tier: "Pro", name: "Pro Rig #1", img: "/img/vga_pro.png", durability: 100 },
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
      case "rakit":      return <Rakit inventory={inventory} setActiveTab={setActiveTab} />;
      case "market":     return <Market onTransactionSuccess={() => console.log("ok")} />;
      case "profil":     return <Profil />;
      default:           return null;
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
    <div className="app-wrap">
      {/* Top header */}
      <header className="app-top">
        <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
          <div className="flex items-center gap-2.5">
            <div className="logo" />
            <div>
              <div className="font-bold text-sm leading-none">BaseTC Mining Console</div>
              <div className="text-xs text-[var(--muted)]">Farcaster Mini App</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="pill">
              <span className="text-[var(--muted)]">Balance</span>
              <strong className="text-[var(--text)]">12,345</strong>
            </div>
            <button className="btn btn-primary">Claim</button>
          </div>
        </div>
      </header>

      {/* Main content (with bottom padding for nav) */}
      <main className="content">
        {renderContent()}
      </main>

      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}

