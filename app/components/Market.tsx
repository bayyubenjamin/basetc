"use client";
import { useState, useEffect, FC, ReactNode } from "react";
import Image from 'next/image';
import { ethers } from 'ethers';
import { useWeb3 } from "../context/Web3Provider";

// --- Types & Data ---
type TierID = 'basic' | 'pro' | 'legend';
interface NFTTier {
  id: TierID;
  name: string;
  image: string;
  hashrateHint: string;
  slotMax: number;
}

const NFT_DATA: NFTTier[] = [
  { id: 'basic', name: 'Basic Rig', image: '/img/vga_basic.png', hashrateHint: '~1.5 H/s', slotMax: 10 },
  { id: 'pro', name: 'Pro Rig', image: '/img/vga_pro.png', hashrateHint: '~5.0 H/s', slotMax: 5 },
  { id: 'legend', name: 'Legend Rig', image: '/img/vga_legend.png', hashrateHint: '~25.0 H/s', slotMax: 3 },
];

// --- Helper & UI Components ---
const Icon: FC<{ path: string; className?: string }> = ({ path, className = "w-5 h-5" }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d={path} /></svg>);
const Toast: FC<{ message: string; type: 'success' | 'error' }> = ({ message, type }) => (<div className={`fixed top-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg text-white font-semibold text-sm animate-fade-in-down z-50 ${type === 'success' ? 'bg-green-500/90' : 'bg-red-500/90'}`}>{message}</div>);

const TierCard: FC<{ tier: NFTTier; onMint: () => void; isDisabled: boolean; buttonText: string }> = ({ tier, onMint, isDisabled, buttonText }) => (
    <div className="flex flex-col rounded-xl border border-[#202838] bg-gradient-to-b from-[#0f1622] to-[#0c1119] shadow-lg overflow-hidden">
        <div className="relative"><Image src={tier.image} alt={tier.name} width={400} height={400} className="w-full aspect-square object-cover" /></div>
        <div className="p-4 flex flex-col flex-grow">
            <h3 className="text-xl font-bold">{tier.name}</h3>
            <div className="text-xs text-gray-400 mt-3 space-y-1 border-t border-gray-700 pt-3">
                <p className="flex justify-between">Est. Hashrate: <span className="font-semibold text-gray-200">{tier.hashrateHint}</span></p>
                <p className="flex justify-between">Max Slots: <span className="font-semibold text-gray-200">{tier.slotMax}</span></p>
            </div>
            <button 
                onClick={onMint} 
                disabled={isDisabled} 
                className="mt-4 w-full rounded-lg py-3 text-base font-bold transition-all duration-300 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed bg-cyan-500 text-white shadow-lg shadow-cyan-500/30 hover:bg-cyan-400"
            >
                {buttonText}
            </button>
        </div>
    </div>
);

// --- Props Baru ---
interface MarketProps {
    onTransactionSuccess: () => void;
}

// --- Komponen Utama Market ---
export default function Market({ onTransactionSuccess }: MarketProps) {
    const { account, gameCoreContract } = useWeb3();
    const [hasClaimedFreeBasic, setHasClaimedFreeBasic] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    
    useEffect(() => {
        const checkClaimStatus = async () => {
            if (gameCoreContract && account) {
                try {
                    const playerData = await gameCoreContract.players(account);
                    setHasClaimedFreeBasic(playerData.hasClaimedFreeBasic);
                } catch (e) {
                    console.error("Could not check claim status:", e);
                }
            }
        };
        checkClaimStatus();
    }, [gameCoreContract, account, onTransactionSuccess]);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    };

    const handleClaimFreeMint = async () => {
        if (!gameCoreContract || hasClaimedFreeBasic) return;
        
        setIsProcessing(true);
        showToast("Sending transaction...", "success");

        try {
            const tx = await gameCoreContract.claimFreeBasic();
            await tx.wait();
            showToast("Free Rig claimed successfully!", "success");
            setHasClaimedFreeBasic(true);
            onTransactionSuccess();
        } catch (error: any) {
            console.error("Claim failed:", error);
            showToast(error.reason || "Claim failed. Check console.", "error");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleMintClick = (tier: TierID) => {
        if (isProcessing) return;

        if (tier === 'basic') {
            handleClaimFreeMint();
        } else {
            showToast("Minting for Pro/Legend is coming in a future update!", "success");
        }
    };

    const getButtonText = (tierId: TierID) => {
        if (isProcessing && tierId === 'basic') return "Claiming...";
        if (tierId === 'basic') {
            return hasClaimedFreeBasic ? "Already Claimed" : "Claim Free Rig";
        }
        return "Mint (Coming Soon)";
    };

    return (
        <div className="mx-auto max-w-[430px] px-3 pb-4 pt-3 flex-grow flex flex-col gap-4">
            {toast && <Toast message={toast.message} type={toast.type} />}
            
            <header className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Icon path="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c.51 0 .962-.343 1.087-.835l.383-1.437M7.5 14.25L5.106 5.165A2.25 2.25 0 017.25 3h9.5a2.25 2.25 0 012.144 2.165L16.5 14.25" className="w-8 h-8 text-purple-400" />
                    <h1 className="text-xl font-bold">Market</h1>
                </div>
            </header>
            
            <div className="border-t border-gray-700/50 my-2"></div>

            <div className="flex flex-col gap-4">
                {NFT_DATA.map(tier => (
                    <TierCard 
                        key={tier.id} 
                        tier={tier} 
                        onMint={() => handleMintClick(tier.id)}
                        isDisabled={tier.id === 'basic' ? hasClaimedFreeBasic || isProcessing : false}
                        buttonText={getButtonText(tier.id)}
                    />
                ))}
            </div>
        </div>
    );
}
