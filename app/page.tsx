"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { ethers } from 'ethers';
import { useAccount } from 'wagmi';
import { ConnectWallet } from '@coinbase/onchainkit/wallet';
import { init } from '@farcaster/miniapp-sdk'; // <-- BARIS INI DITAMBAHKAN
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';

// Impor komponen UI Anda
import Monitoring from './components/Monitoring';
import Navigation from './components/Navigation';
import Rakit from './components/Rakit';
import Market from './components/Market';
import Profil from './components/Profil';

// Impor konfigurasi dan ABI
import { gameCoreAddress, gameCoreABI, rigNftAddress, rigNftABI, baseTcAddress, baseTcABI } from './lib/web3Config';

export type TabName = 'monitoring' | 'rakit' | 'market' | 'profil';
export interface Nft {
  id: number;
  tier: "Basic" | "Pro" | "Legend";
  name: string;
  img: string;
  durability: number;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabName>('monitoring');
  const { address, isConnected } = useAccount();

  // --- Inisialisasi Farcaster SDK ---
  useEffect(() => {
    const sdk = init();
    sdk.actions.ready();
  }, []);
  // ------------------------------------

  const [inventory, setInventory] = useState<Nft[]>([]);
  const [unclaimedRewards, setUnclaimedRewards] = useState("0");
  const [totalBalance, setTotalBalance] = useState("0");
  const [lastClaimTimestamp, setLastClaimTimestamp] = useState(0);
  const [mining, setMining] = useState(true);

  const { data: playerData, refetch: refetchPlayerData } = useReadContract({
    address: gameCoreAddress, abi: gameCoreABI, functionName: 'players', args: [address], query: { enabled: isConnected },
  });
  const { data: pendingRewardsData, refetch: refetchPendingRewards } = useReadContract({
    address: gameCoreAddress, abi: gameCoreABI, functionName: 'pendingReward', args: [address], query: { enabled: isConnected },
  });
  const { data: balanceData, refetch: refetchBalance } = useReadContract({
    address: baseTcAddress, abi: baseTcABI, functionName: 'balanceOf', args: [address], query: { enabled: isConnected },
  });
  const { data: inventoryData, refetch: refetchInventory } = useReadContract({
    address: rigNftAddress, abi: rigNftABI, functionName: 'balanceOfBatch', args: [Array(4).fill(address), [1, 2, 3, 4]], query: { enabled: isConnected },
  });
  const { data: hash, writeContract, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (playerData) setLastClaimTimestamp(Number((playerData as any).lastRewardClaimTimestamp) * 1000);
    if (pendingRewardsData) setUnclaimedRewards(ethers.formatEther(pendingRewardsData as ethers.BigNumberish));
    if (balanceData) setTotalBalance(ethers.formatEther(balanceData as ethers.BigNumberish));
    if (inventoryData) {
        const newInventory: Nft[] = [];
        const tierNames: Nft['tier'][] = ["Basic", "Pro", "Legend"];
        (inventoryData as ethers.BigNumberish[]).forEach((bal, i) => {
            const tierName = tierNames[i];
            if (tierName) {
                for (let j = 0; j < Number(bal); j++) {
                    newInventory.push({ id: (i + 1) * 100 + j, tier: tierName, name: `${tierName} Rig #${j + 1}`, img: `/img/vga_${tierName.toLowerCase()}.png`, durability: 100 });
                }
            }
        });
        setInventory(newInventory);
    }
  }, [playerData, pendingRewardsData, balanceData, inventoryData]);

  useEffect(() => {
    if (isConfirmed) {
        refetchPlayerData(); refetchPendingRewards(); refetchBalance(); refetchInventory();
    }
  }, [isConfirmed, refetchBalance, refetchInventory, refetchPlayerData, refetchPendingRewards]);

  if (!isConnected) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-900 text-white items-center justify-center space-y-4">
        <Image src="/img/logo.png" alt="BaseTC Logo" width={96} height={96} />
        <h1 className="text-3xl font-bold">Welcome to BaseTC Mining</h1>
        <p className="text-gray-400">Connect your wallet to start your mining operation.</p>
        <div className="mt-4">
          <ConnectWallet />
        </div>
      </div>
    );
  }

  const handleClaim = async () => {
    writeContract({ address: gameCoreAddress, abi: gameCoreABI, functionName: 'claimReward', args: [] });
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'monitoring':
        return <Monitoring inventory={inventory} mining={mining} setMining={setMining} unclaimedRewards={Number(unclaimedRewards)} lastClaimTimestamp={lastClaimTimestamp} handleClaim={handleClaim} isClaiming={isPending || isConfirming} />;
      case 'rakit':
        return <Rakit inventory={inventory} setInventory={setInventory} setActiveTab={setActiveTab} />;
      case 'market':
        return <Market onTransactionSuccess={() => { refetchPlayerData(); refetchInventory(); }} />;
      case 'profil':
        return <Profil />;
      default: return <div></div>;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white">
      <header className="sticky top-0 left-0 right-0 bg-gray-800 p-4 flex items-center justify-between border-b border-gray-700 z-10">
        <div className="flex items-center space-x-2">
          <Image src="/img/logo.png" alt="BaseTC Logo" width={32} height={32} />
          <h1 className="text-xl font-bold">BaseTC Mining</h1>
        </div>
        <div className="text-sm font-semibold">
           {address && `${address.substring(0, 6)}...${address.substring(address.length - 4)}`}
        </div>
      </header>
      {renderContent()}
      <Navigation activeTab={activeTab as TabName} setActiveTab={setActiveTab as any} />
    </div>
  );
}
