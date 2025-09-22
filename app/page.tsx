"use client";

import { useState, useEffect, useMemo } from "react";
import { ethers } from "ethers";
import { useAccount, useConnect } from "wagmi";
import { sdk } from "@farcaster/miniapp-sdk";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";

// Komponen Desain Ulang
import Monitoring from "./components/Monitoring";
import Navigation from "./components/Navigation";
import Rakit from "./components/Rakit";
import Market from "./components/Market";
import Profil from "./components/Profil";

// Config & ABI (pastikan path ini benar)
import { gameCoreAddress, gameCoreABI, rigNftAddress, rigNftABI, baseTcAddress, baseTcABI } from "./lib/web3Config";

// Tipe
export type TabName = "monitoring" | "rakit" | "market" | "profil";
export interface Nft {
  id: number;
  tier: "Basic" | "Pro" | "Legend";
  name: string;
  img: string;
  durability: number;
}

// Skeleton Loader untuk transisi mulus
const AppSkeletonLoader = () => (
    <div className="app-shell animate-pulse">
        <header className="grid grid-cols-[1fr_auto] gap-2 items-center">
            <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-panel rounded-lg border border-edge"></div>
                <div>
                    <div className="h-4 w-32 bg-panel rounded"></div>
                    <div className="h-3 w-24 bg-panel rounded mt-1"></div>
                </div>
            </div>
            <div className="flex items-center gap-1.5">
                <div className="h-8 w-32 bg-panel rounded-full"></div>
                <div className="h-8 w-16 bg-panel rounded-lg"></div>
            </div>
        </header>
        <div className="flex-grow panel"></div>
        <div className="bottom-nav">
          <div className="bottom-nav-inner h-[60px]"></div>
        </div>
    </div>
);

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabName>("monitoring");
  const { address, isConnected, isConnecting } = useAccount();
  const { connectors, connect } = useConnect();
  
  const [totalBalance, setTotalBalance] = useState("0");
  const [inventory, setInventory] = useState<Nft[]>([]); // Placeholder data
  // State lainnya...

  // FIX: Panggil sdk.actions.ready() dan auto-connect di sini
  useEffect(() => {
    sdk.actions.ready();
    console.log("Farcaster SDK Ready");
    
    const farcasterConnector = connectors.find((c) => c.id === "farcaster");
    if (!isConnected && !isConnecting && farcasterConnector) {
      connect({ connector: farcasterConnector });
    }
  }, [isConnected, isConnecting, connectors, connect]);
  
  // Wagmi hooks untuk data on-chain (contoh)
  const { data: balanceData } = useReadContract({
    address: baseTcAddress,
    abi: baseTcABI,
    functionName: 'balanceOf',
    args: [address],
    query: { enabled: isConnected },
  });

  useEffect(() => {
    if (balanceData) {
      const formattedBalance = parseFloat(ethers.formatEther(balanceData as any)).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
      setTotalBalance(formattedBalance);
    }
  }, [balanceData]);
  
  const { writeContract, isPending } = useWriteContract();
  
  const handleClaim = () => {
    writeContract({
      address: gameCoreAddress,
      abi: gameCoreABI,
      functionName: 'claimReward',
      args: [],
    })
  }

  // Tampilan loading/koneksi yang mulus
  if (!isConnected || isConnecting) {
    return <AppSkeletonLoader />;
  }
  
  const renderContent = () => {
    switch (activeTab) {
      case "monitoring": return <Monitoring />;
      case "rakit": return <Rakit inventory={inventory} setActiveTab={setActiveTab} />;
      case "market": return <Market onTransactionSuccess={() => {}} />;
      case "profil": return <Profil />;
      default: return null;
    }
  };

  return (
    <div className="app-shell">
       <header className="grid grid-cols-[1fr_auto] gap-2 items-center">
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
                <strong className="text-[color:var(--text)]">{totalBalance}</strong>
                <span className="text-[color:var(--muted)]">$BaseTC</span>
            </div>
            <button
              onClick={handleClaim}
              disabled={isPending}
              className="btn btn-primary"
            >
              {isPending ? '...' : 'Claim'}
            </button>
          </div>
       </header>

      {renderContent()}

      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}
