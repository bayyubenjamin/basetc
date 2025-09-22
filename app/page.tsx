"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { ethers } from "ethers";
import { useAccount, useConnect } from "wagmi";
import { ConnectWallet } from "@coinbase/onchainkit/wallet";
import { sdk } from "@farcaster/miniapp-sdk";
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";

// Redesigned Components
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
  durability: number; // Percentage
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabName>("monitoring");

  const { address, isConnected, connector } = useAccount();
  const { connectors, connect } = useConnect();
  const [farcasterUser, setFarcasterUser] = useState<FarcasterUser | null>(null);

  // --- Farcaster & Wallet Connection ---
  useEffect(() => {
    sdk.actions.ready();
    const farcasterConnector = connectors.find((c) => c.id === "farcaster");
    if (!isConnected && farcasterConnector) {
      connect({ connector: farcasterConnector });
    }
  }, [isConnected, connectors, connect]);

  useEffect(() => {
    if (isConnected && connector?.id === "farcaster") {
      (async () => {
        try {
          const user = await (connector as any).getFarcasterUser?.();
          if (user) setFarcasterUser(user);
        } catch (error) {
          console.error("Failed to get Farcaster user:", error);
        }
      })();
    }
  }, [isConnected, connector]);


  // ---------- On-chain states ----------
  const [inventory, setInventory] = useState<Nft[]>([]);
  const [unclaimedRewards, setUnclaimedRewards] = useState("0");
  const [lastClaimTimestamp, setLastClaimTimestamp] = useState(0);
  const [mining, setMining] = useState(true);

  const queryEnabled = useMemo(() => Boolean(address && isConnected), [address, isConnected]);

  // --- wagmi hooks ---
  const { data: playerData, refetch: refetchPlayerData } = useReadContract({
    address: gameCoreAddress,
    abi: gameCoreABI,
    functionName: "players",
    args: [address],
    query: { enabled: queryEnabled, refetchInterval: 30000 }, // Refetch player data every 30s
  });

  const { data: pendingRewardsData, refetch: refetchPendingRewards } = useReadContract({
    address: gameCoreAddress,
    abi: gameCoreABI,
    functionName: "pendingReward",
    args: [address],
    query: { enabled: queryEnabled, refetchInterval: 10000 }, // Refetch rewards every 10s
  });

  const { data: inventoryData, refetch: refetchInventory } = useReadContract({
    address: rigNftAddress,
    abi: rigNftABI,
    functionName: "balanceOfBatch",
    args: [Array(3).fill(address), [1, 2, 3]],
    query: { enabled: queryEnabled },
  });
  
  const { data: hash, writeContract, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });


  // --- Data Mapping & State Updates ---
  useEffect(() => {
    if (playerData) {
      setLastClaimTimestamp(Number((playerData as any).lastRewardClaimTimestamp) * 1000);
    }
    if (pendingRewardsData) {
      setUnclaimedRewards(ethers.formatEther(pendingRewardsData as ethers.BigNumberish));
    }
    if (inventoryData) {
      const newInventory: Nft[] = [];
      const tierNames: Nft["tier"][] = ["Basic", "Pro", "Legend"];
      (inventoryData as ethers.BigNumberish[]).forEach((bal, i) => {
        const tierName = tierNames[i];
        if (tierName) {
          for (let j = 0; j < Number(bal); j++) {
            newInventory.push({
              id: (i + 1) * 100 + j,
              tier: tierName,
              name: `${tierName} Rig #${j + 1}`,
              img: `/img/vga_${tierName.toLowerCase()}.png`,
              durability: 100, // Placeholder
            });
          }
        }
      });
      setInventory(newInventory);
    }
  }, [playerData, pendingRewardsData, inventoryData]);

  // --- Transaction Confirmation Effect ---
  useEffect(() => {
    if (isConfirmed) {
      refetchPlayerData();
      refetchPendingRewards();
      refetchInventory();
    }
  }, [isConfirmed, refetchInventory, refetchPlayerData, refetchPendingRewards]);

  // --- Render Logic ---
  if (!isConnected) {
    return (
      <div className="flex flex-col min-h-dvh items-center justify-center space-y-4 p-4 text-center bg-gradient-to-b from-[--background-primary] to-[#000]">
        <Image src="/img/logo.png" alt="BaseTC Logo" width={96} height={96} className="rounded-2xl shadow-lg"/>
        <h1 className="text-3xl font-extrabold text-white">BaseTC Mining</h1>
        <p className="text-[--text-secondary]">Connect your Farcaster wallet to start mining.</p>
        <div className="pt-4"><ConnectWallet /></div>
      </div>
    );
  }

  const handleClaim = async () => {
    writeContract({
      address: gameCoreAddress,
      abi: gameCoreABI,
      functionName: "claimReward",
      args: [],
    });
  };

  const renderContent = () => {
    switch (activeTab) {
      case "monitoring":
        return <Monitoring inventory={inventory} mining={mining} setMining={setMining} unclaimedRewards={Number(unclaimedRewards)} lastClaimTimestamp={lastClaimTimestamp} handleClaim={handleClaim} isClaiming={isPending || isConfirming} />;
      case "rakit":
        return <Rakit inventory={inventory} setActiveTab={setActiveTab} />;
      case "market":
        return <Market onTransactionSuccess={() => { refetchPlayerData(); refetchInventory(); }} />;
      case "profil":
        return <Profil />;
      default: return null;
    }
  };

  return (
    <div className="app-shell">
      <header className="sticky top-0 bg-[--background-primary]/80 backdrop-blur-md p-3 flex items-center justify-between border-b border-[--border-primary] z-50">
          <div className="flex items-center gap-3">
              <Image src={farcasterUser?.pfpUrl || "/img/logo.png"} alt="User PFP" width={32} height={32} className="rounded-full" />
              <div>
                  <h1 className="font-bold text-base leading-tight">{farcasterUser?.displayName || 'Miner'}</h1>
                  <p className="text-xs text-[--text-secondary]">@{farcasterUser?.username || `fid:${farcasterUser?.fid}`}</p>
              </div>
          </div>
           <div className="text-xs font-mono bg-[--background-secondary] px-2 py-1 rounded-md border border-[--border-primary] text-[--text-secondary]">
              {address && `${address.substring(0, 6)}...${address.substring(address.length - 4)}`}
           </div>
      </header>

      <main className="mini-app-content">
        {renderContent()}
      </main>

      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}
