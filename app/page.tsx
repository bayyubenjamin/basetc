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

// UI
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

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabName>("monitoring");

  const { address, isConnected, connector } = useAccount();
  const { connectors, connect } = useConnect();
  const [farcasterUser, setFarcasterUser] = useState<FarcasterUser | null>(null);

  // Init Farcaster MiniApp + auto-connect Farcaster connector
  useEffect(() => {
    sdk.actions.ready();
    const farcasterConnector = connectors.find((c) => c.id === "farcaster");
    if (!isConnected && farcasterConnector) {
      connect({ connector: farcasterConnector });
    }
  }, [isConnected, connectors, connect]);

  // Get Farcaster user from connector
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
  const [totalBalance, setTotalBalance] = useState("0");
  const [lastClaimTimestamp, setLastClaimTimestamp] = useState(0);
  const [mining, setMining] = useState(true);

  const queryEnabled = useMemo(() => Boolean(address && isConnected), [address, isConnected]);

  const { data: playerData, refetch: refetchPlayerData } = useReadContract({
    address: gameCoreAddress,
    abi: gameCoreABI,
    functionName: "players",
    args: [address],
    query: { enabled: queryEnabled },
  });

  const { data: pendingRewardsData, refetch: refetchPendingRewards } = useReadContract({
    address: gameCoreAddress,
    abi: gameCoreABI,
    functionName: "pendingReward",
    args: [address],
    query: { enabled: queryEnabled },
  });

  const { data: balanceData, refetch: refetchBalance } = useReadContract({
    address: baseTcAddress,
    abi: baseTcABI,
    functionName: "balanceOf",
    args: [address],
    query: { enabled: queryEnabled },
  });

  const { data: inventoryData, refetch: refetchInventory } = useReadContract({
    address: rigNftAddress,
    abi: rigNftABI,
    functionName: "balanceOfBatch",
    // accounts[] dan ids[] harus sama panjang → 3 tier + 1 dummy/slot (menjaga kompat)
    args: [Array(4).fill(address), [1, 2, 3, 4]],
    query: { enabled: queryEnabled },
  });

  const { data: hash, writeContract, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  // Map data on-chain ke state UI
  useEffect(() => {
    if (playerData) {
      setLastClaimTimestamp(Number((playerData as any).lastRewardClaimTimestamp) * 1000);
    }
    if (pendingRewardsData) {
      setUnclaimedRewards(ethers.formatEther(pendingRewardsData as ethers.BigNumberish));
    }
    if (balanceData) {
      setTotalBalance(ethers.formatEther(balanceData as ethers.BigNumberish));
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
              durability: 100,
            });
          }
        }
      });
      setInventory(newInventory);
    }
  }, [playerData, pendingRewardsData, balanceData, inventoryData]);

  // Refresh setelah tx confirm
  useEffect(() => {
    if (isConfirmed) {
      refetchPlayerData();
      refetchPendingRewards();
      refetchBalance();
      refetchInventory();
    }
  }, [isConfirmed, refetchBalance, refetchInventory, refetchPlayerData, refetchPendingRewards]);

  // ---------- Not connected view ----------
  if (!isConnected) {
    return (
      <div className="flex flex-col min-h-dvh bg-[#0b1118] text-white items-center justify-center space-y-4 p-4 text-center">
        <Image src="/img/logo.png" alt="BaseTC Logo" width={96} height={96} />
        <h1 className="text-2xl font-extrabold">Welcome to BaseTC Mining</h1>
        <p className="text-[#9aacc6]">Connecting to Farcaster wallet...</p>
        <div className="mt-3 opacity-70">
          <ConnectWallet />
        </div>
        <p className="text-[11px] text-gray-500 mt-2">
          If connection doesn&apos;t happen automatically, make sure you are in a Farcaster client and try connecting manually.
        </p>
      </div>
    );
  }

  // ---------- Actions ----------
  const handleClaim = async () => {
    writeContract({
      address: gameCoreAddress,
      abi: gameCoreABI,
      functionName: "claimReward",
      args: [],
    });
  };

  // ---------- Tabs ----------
  const renderContent = () => {
    switch (activeTab) {
      case "monitoring":
        return (
          <Monitoring
            inventory={inventory}
            mining={mining}
            setMining={setMining}
            unclaimedRewards={Number(unclaimedRewards)}
            lastClaimTimestamp={lastClaimTimestamp}
            handleClaim={handleClaim}
            isClaiming={isPending || isConfirming}
          />
        );
      case "rakit":
        return <Rakit inventory={inventory} setInventory={setInventory} setActiveTab={setActiveTab} />;
      case "market":
        return <Market onTransactionSuccess={() => { refetchPlayerData(); refetchInventory(); }} />;
      case "profil":
        return <Profil />;
      default:
        return null;
    }
  };

  // ---------- Layout ----------
  return (
    <div className="flex flex-col min-h-dvh bg-[#0b1118]">
      {/* Header */}
      <header className="sticky top-0 left-0 right-0 bg-[#101826] p-3 flex items-center justify-between border-b border-white/10 z-10">
        <div className="flex items-center gap-2">
          <Image src="/img/logo.png" alt="BaseTC Logo" width={26} height={26} />
          <div className="leading-tight">
            <h1 className="text-[18px] font-extrabold">BaseTC Mining</h1>
            {farcasterUser && (
              <p className="text-[11px] text-purple-400">
                @{farcasterUser.username || `FID: ${farcasterUser.fid}`}
              </p>
            )}
          </div>
        </div>
        <div className="text-[11px] font-semibold text-[#9aacc6]">
          {address && `${address.substring(0, 6)}...${address.substring(address.length - 4)}`}
        </div>
      </header>

      {/* Konten dengan padding bawah agar tidak ketiban bottom-nav */}
      <main className="mini-app-content">
        {renderContent()}
      </main>

      {/* Bottom navigation (fixed, didefinisikan stylenya di globals.css .bottom-nav) */}
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}

