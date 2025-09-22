"use client";
import { useState, useEffect, FC } from "react";
import Image from 'next/image';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { gameCoreAddress, gameCoreABI } from "../lib/web3Config";

// --- Types & Data ---
type TierID = 'basic' | 'pro' | 'legend';
interface NFTTier {
  id: TierID;
  name: string;
  image: string;
  hashrateHint: string;
  slotMax: number;
  price?: string; // Optional price for non-free mints
}

const NFT_DATA: NFTTier[] = [
  { id: 'basic', name: 'Basic Rig',  image: '/img/vga_basic.png',  hashrateHint: '~1.5 H/s', slotMax: 10, price: 'Free' },
  { id: 'pro',   name: 'Pro Rig',    image: '/img/vga_pro.png',    hashrateHint: '~5.0 H/s', slotMax: 5, price: 'TBA' },
  { id: 'legend',name: 'Legend Rig', image: '/img/vga_legend.png', hashrateHint: '~25.0 H/s', slotMax: 3, price: 'TBA' },
];

// --- UI helpers ---
const Icon: FC<{ path: string; className?: string }> = ({ path, className = "w-5 h-5" }) =>
  (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>);

const Toast: FC<{ message: string; type: 'success' | 'error' }> = ({ message, type }) =>
  (<div className={`fixed top-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg text-white font-semibold text-sm animate-fadeInUp z-50 ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
    {message}
  </div>);

const TierCard: FC<{ tier: NFTTier; onMint: () => void; isDisabled: boolean; buttonText: string }> =
  ({ tier, onMint, isDisabled, buttonText }) => (
    <div className="flex flex-col rounded-lg border border-[--border-primary] bg-[--background-secondary] shadow-lg overflow-hidden transition-all hover:border-[--accent-purple]">
      <div className="relative h-48 w-full">
        <Image src={tier.image} alt={tier.name} layout="fill" objectFit="cover" />
      </div>
      <div className="p-4 flex flex-col flex-grow">
        <div className="flex justify-between items-start">
          <h3 className="text-xl font-bold">{tier.name}</h3>
          <p className="text-lg font-bold text-[--accent-yellow]">{tier.price}</p>
        </div>
        <div className="text-sm text-[--text-secondary] mt-4 space-y-2 border-t border-[--border-primary] pt-3">
          <p className="flex justify-between">Est. Hashrate: <span className="font-semibold text-[--text-primary]">{tier.hashrateHint}</span></p>
          <p className="flex justify-between">Max Slots: <span className="font-semibold text-[--text-primary]">{tier.slotMax}</span></p>
        </div>
        <button
          onClick={onMint}
          disabled={isDisabled}
          className="mt-4 w-full rounded-md py-3 text-base font-bold transition-all duration-300 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed bg-[--accent-purple] text-white shadow-lg shadow-purple-500/20 hover:bg-purple-700"
        >
          {buttonText}
        </button>
      </div>
    </div>
  );

// --- Props ---
interface MarketProps { onTransactionSuccess: () => void; }

// --- Component ---
export default function Market({ onTransactionSuccess }: MarketProps) {
  const { address, isConnected } = useAccount();

  const { data: playerData, refetch: refetchPlayer } = useReadContract({
    address: gameCoreAddress,
    abi: gameCoreABI,
    functionName: 'players',
    args: [address],
    query: { enabled: !!address && isConnected },
  });

  const hasClaimedFreeBasic: boolean = (playerData as any)?.hasClaimedFreeBasic ?? true;

  const { data: txHash, writeContract, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (isConfirmed) {
      setToast({ message: "Free Rig claimed successfully!", type: "success" });
      onTransactionSuccess();
      refetchPlayer();
    }
  }, [isConfirmed, onTransactionSuccess, refetchPlayer]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleClaimFreeMint = async () => {
    if (!isConnected || !address || hasClaimedFreeBasic || isPending || isConfirming) return;
    showToast("Sending transaction...", "success");
    writeContract({
      address: gameCoreAddress,
      abi: gameCoreABI,
      functionName: 'claimFreeBasic',
      args: [],
    });
  };

  const handleMintClick = (tier: TierID) => {
    if (tier === 'basic') handleClaimFreeMint();
    else showToast("Minting for Pro/Legend is coming soon!", "success");
  };

  const getButtonText = (tierId: TierID) => {
    if (tierId === 'basic') {
      if (isPending || isConfirming) return "Claiming...";
      return hasClaimedFreeBasic ? "Already Claimed" : "Claim Free Rig";
    }
    return "Coming Soon";
  };

  return (
    <div className="p-4 space-y-4 animate-fadeInUp">
      {toast && <Toast message={toast.message} type={toast.type} />}

      <header className="flex items-center gap-3">
        <Icon path="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c.51 0 .962-.343 1.087-.835l.383-1.437M7.5 14.25L5.106 5.165A2.25 2.25 0 017.25 3h9.5a2.25 2.25 0 012.144 2.165L16.5 14.25" className="w-8 h-8 text-[--accent-purple]"/>
        <div>
          <h1 className="text-xl font-bold leading-tight">Rig Market</h1>
          <p className="text-xs text-[--text-secondary]">Acquire new rigs to boost your hashrate.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4">
        {NFT_DATA.map((tier) => (
          <TierCard
            key={tier.id}
            tier={tier}
            onMint={() => handleMintClick(tier.id)}
            isDisabled={(tier.id === 'basic' && (hasClaimedFreeBasic || isPending || isConfirming)) || tier.id !== 'basic'}
            buttonText={getButtonText(tier.id)}
          />
        ))}
      </div>
    </div>
  );
}
