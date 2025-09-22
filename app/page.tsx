"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { ethers } from "ethers";
import { useAccount, useConnect } from "wagmi";
import { sdk } from "@farcaster/miniapp-sdk";
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";

// Components
import Monitoring from "./components/Monitoring";
import Navigation from "./components/Navigation";
import Rakit from "./components/Rakit";
import Market from "./components/Market";
import Profil from "./components/Profil";

// Config & ABI
import {
  gameCoreAddress,
  gameCoreABI,
  rigNftAddress,
  rigNftABI,
  baseTcAddress,
  baseTcABI,
} from "./lib/web3Config";

// --- Types ---
type FarcasterUser = {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
};
export type TabName = "monitoring" | "rakit" | "market" | "profil";
export interface Nft {
  id: number;
  tier: "Basic" | "Pro" | "Legend";
  name: string;
  img: string;
  durability: number;
}

// --- Skeleton Loader ---
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
        <main className="flex-grow p-2.5 bg-monitor-from border border-edge rounded-card shadow-main">
            <div className="w-full h-full bg-screen-bg rounded-lg"></div>
        </main>
    </div>
);


export default function Home() {
  const [activeTab, setActiveTab] = useState<TabName>("monitoring");
  const { address, isConnected, connector, isConnecting } = useAccount();
  const { connectors, connect } = useConnect();
  const [farcasterUser, setFarcasterUser] = useState<FarcasterUser | null>(null);

  // Auto-connect logic remains the same
  useEffect(() => {
    sdk.actions.ready();
    const farcasterConnector = connectors.find((c) => c.id === "farcaster");
    if (!isConnected && !isConnecting && farcasterConnector) {
      connect({ connector: farcasterConnector });
    }
  }, [isConnected, isConnecting, connectors, connect]);

  useEffect(() => {
    if (isConnected && connector?.id === "farcaster") {
      (async () => {
        try {
          const user = await (connector as any).getFarcasterUser?.();
          if (user) setFarcasterUser(user);
        } catch (error) { console.error("Farcaster user error:", error); }
      })();
    }
  }, [isConnected, connector]);

  // --- On-chain states & wagmi hooks (logic remains the same) ---
  const [inventory, setInventory] = useState<Nft[]>([]);
  const [unclaimedRewards, setUnclaimedRewards] = useState("0");
  const [totalBalance, setTotalBalance] = useState("0");
  const [lastClaimTimestamp, setLastClaimTimestamp] = useState(0);
  const [mining, setMining] = useState(true);

  const queryEnabled = useMemo(() => Boolean(address && isConnected), [address, isConnected]);

  const { data: balanceData, refetch: refetchBalance } = useReadContract({
    address: baseTcAddress,
    abi: baseTcABI,
    functionName: "balanceOf",
    args: [address],
    query: { enabled: queryEnabled },
  });

  const { data: hash, writeContract, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (balanceData) {
      setTotalBalance(parseFloat(ethers.formatEther(balanceData as ethers.BigNumberish)).toLocaleString());
    }
  }, [balanceData]);

  // ... other hooks and logic ...

  if (!isConnected || isConnecting) {
    return <AppSkeletonLoader />;
  }
  
  const handleClaim = async () => { /* ... */ };

  const renderContent = () => {
    switch (activeTab) {
      case "monitoring": return <Monitoring />;
      // Pass props to other components as needed
      case "rakit": return <Rakit inventory={[]} setActiveTab={setActiveTab} />;
      case "market": return <Market onTransactionSuccess={() => {}} />;
      case "profil": return <Profil />;
      default: return null;
    }
  };

  return (
    <div className="app-shell">
       <header className="grid grid-cols-[1fr_auto] gap-2 items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-b from-brand-logo-from to-brand-logo-to border border-[#25344a] shadow-main" />
            <div>
              <div className="font-bold text-sm leading-none">BaseTC Mining Console</div>
              <div className="text-xs text-text-muted">Farcaster Mini App</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1.5 bg-gradient-to-b from-pill-from to-pill-to text-xs px-2.5 py-1.5 rounded-full border border-[#233045]">
                <span className="text-text-muted">Balance</span>
                <strong className="text-text-primary">{totalBalance}</strong>
                <span className="text-text-muted">$BaseTC</span>
            </div>
            <button
              onClick={handleClaim}
              disabled={isPending || isConfirming}
              className="bg-gradient-to-b from-btn-primary-from to-btn-primary-to border border-[#30435e] text-text-primary text-sm font-bold px-4 py-1.5 rounded-lg"
            >
              Claim
            </button>
          </div>
       </header>

      <main className="flex-grow">
        {renderContent()}
      </main>

      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}
