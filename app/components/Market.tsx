"use client";
import { useState, useMemo, FC, ReactNode } from "react";
import Image from 'next/image';

// --- Types & Dummy Data (sesuai brief proyek) ---

type TierID = 'basic' | 'pro' | 'legend';
type Currency = 'USDC' | 'BaseTC';

interface NFTTier {
  id: TierID;
  name: string;
  priceUsd: number;
  promoPriceUsd?: number;
  image: string;
  hashrateHint: string;
  slotMax: number;
  limitedCap?: number;
  minted?: number;
}

interface User {
  freeMintAvailable: boolean;
  invites: number;
  referralUrl: string;
  balances: { usdc: number; baseTC: number };
}

const NFT_DATA: NFTTier[] = [
  { id: 'basic', name: 'Basic Rig', priceUsd: 2, promoPriceUsd: 1, image: '/img/basic.png', hashrateHint: '~1.5 H/s', slotMax: 10 },
  { id: 'pro', name: 'Pro Rig', priceUsd: 20, image: '/img/pro.png', hashrateHint: '~5.0 H/s', slotMax: 5 },
  { id: 'legend', name: 'Legend Rig', priceUsd: 200, image: '/img/legend.png', hashrateHint: '~25.0 H/s', slotMax: 3, limitedCap: 1000, minted: 215 },
];

const PROMO_ACTIVE = true;

// --- Helper Components ---

const Icon: FC<{ path: string; className?: string }> = ({ path, className = "w-5 h-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
);

const Toast: FC<{ message: string; type: 'success' | 'error' }> = ({ message, type }) => (
    <div className={`fixed top-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg text-white font-semibold text-sm animate-fade-in-down z-50 ${
        type === 'success' ? 'bg-green-500/90' : 'bg-red-500/90'
    }`}>
        {message}
    </div>
);


// --- UI Components ---

const FreeMintBanner: FC<{ onClaim: () => void }> = ({ onClaim }) => (
    <div className="relative overflow-hidden flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg">
        <div>
            <p className="font-bold text-sm">Welcome, Miner!</p>
            <p className="text-xs">Claim your first rig for free to start.</p>
        </div>
        <button onClick={onClaim} className="bg-white text-purple-700 font-bold py-1 px-4 rounded-full text-sm hover:bg-gray-200 transition-colors">
            Claim Now
        </button>
    </div>
);

const ReferralPanel: FC<{ invites: number; onCopy: () => void }> = ({ invites, onCopy }) => {
    const progress = (invites / 3) * 100;
    return (
        <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-3">
            <div className="flex justify-between items-center mb-1">
                <p className="text-sm font-semibold">Referral Rewards</p>
                <p className="text-sm font-bold">{invites}/3 Invites</p>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                <div className="bg-gradient-to-r from-cyan-400 to-purple-500 h-2 rounded-full" style={{ width: `${progress}%` }}></div>
            </div>
            <button onClick={onCopy} className="w-full bg-gray-700 hover:bg-gray-600 text-cyan-300 font-semibold py-2 px-4 rounded-md text-sm transition-colors">
                Copy Invite Link
            </button>
        </div>
    );
};

const TierCard: FC<{ tier: NFTTier; onMint: () => void }> = ({ tier, onMint }) => {
    const isSoldOut = tier.limitedCap && tier.minted && tier.minted >= tier.limitedCap;
    const isLowStock = !isSoldOut && tier.limitedCap && tier.minted && tier.minted / tier.limitedCap > 0.9;
    
    return (
        <div className="flex flex-col rounded-xl border border-[#202838] bg-gradient-to-b from-[#0f1622] to-[#0c1119] shadow-lg overflow-hidden">
            <div className="relative">
                <Image src={tier.image} alt={tier.name} width={400} height={400} className="w-full aspect-square object-cover" />
                {tier.limitedCap && (
                    <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-bold">
                        {isSoldOut ? 'SOLD OUT' : `${tier.minted}/${tier.limitedCap}`}
                    </div>
                )}
                {isLowStock && <div className="absolute top-2 left-2 bg-yellow-500/80 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-bold text-black">LOW STOCK</div>}
            </div>
            <div className="p-4 flex flex-col flex-grow">
                <h3 className="text-xl font-bold">{tier.name}</h3>
                <div className="flex items-baseline gap-2 mt-1">
                    {PROMO_ACTIVE && tier.promoPriceUsd !== undefined ? (
                        <>
                            <p className="text-2xl font-bold text-cyan-400">${tier.promoPriceUsd}</p>
                            <p className="text-lg font-medium text-gray-500 line-through">${tier.priceUsd}</p>
                        </>
                    ) : (
                        <p className="text-2xl font-bold text-cyan-400">${tier.priceUsd}</p>
                    )}
                </div>
                
                <div className="text-xs text-gray-400 mt-3 space-y-1 border-t border-gray-700 pt-3">
                    <p className="flex justify-between">Est. Hashrate: <span className="font-semibold text-gray-200">{tier.hashrateHint}</span></p>
                    <p className="flex justify-between">Max Slots: <span className="font-semibold text-gray-200">{tier.slotMax}</span></p>
                </div>

                <button 
                    onClick={onMint}
                    disabled={isSoldOut}
                    className="mt-4 w-full rounded-lg py-3 text-base font-bold transition-all duration-300 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed bg-cyan-500 text-white shadow-lg shadow-cyan-500/30 hover:bg-cyan-400"
                >
                    {isSoldOut ? 'Sold Out' : 'Mint Now'}
                </button>
            </div>
        </div>
    );
};

const MintModal: FC<{ tier: NFTTier; user: User; onClose: () => void; onConfirm: (qty: number, currency: Currency) => void }> = ({ tier, user, onClose, onConfirm }) => {
    const [quantity, setQuantity] = useState(1);
    const [currency, setCurrency] = useState<Currency>('USDC');

    const price = PROMO_ACTIVE && tier.promoPriceUsd !== undefined ? tier.promoPriceUsd : tier.priceUsd;
    const subtotal = price * quantity;
    const userBalance = currency === 'USDC' ? user.balances.usdc : user.balances.baseTC;
    const hasEnoughBalance = userBalance >= subtotal; // Placeholder logic

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end justify-center z-40 animate-fade-in">
            <div className="relative bg-gradient-to-b from-[#0f1622] to-[#0b1118] w-full max-w-[430px] rounded-t-2xl border-t border-gray-700 p-4 animate-slide-up">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white">
                    <Icon path="M6 18L18 6M6 6l12 12" />
                </button>
                
                <div className="flex gap-4">
                    <Image src={tier.image} alt={tier.name} width={120} height={120} className="rounded-lg object-cover aspect-square" />
                    <div className="flex-grow">
                        <h2 className="text-2xl font-bold">{tier.name}</h2>
                        <p className="text-sm text-gray-400 mt-1">Acquire a new rig to boost your mining operation and increase your $BaseTC earnings.</p>
                        <p className="text-xs text-gray-500 mt-2">Target ROI: ~{tier.id === 'basic' ? 10 : 25} days</p>
                    </div>
                </div>

                <div className="mt-4 space-y-3">
                    <div className="flex justify-between items-center bg-gray-800/50 p-2 rounded-md">
                        <label className="text-sm font-semibold">Quantity</label>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-8 h-8 rounded bg-gray-700">-</button>
                            <span className="w-10 text-center font-bold">{quantity}</span>
                            <button onClick={() => setQuantity(q => q + 1)} className="w-8 h-8 rounded bg-gray-700">+</button>
                        </div>
                    </div>
                    
                    {/* Payment Summary */}
                    <div className="border-t border-gray-700 pt-3 text-sm space-y-1">
                        <div className="flex justify-between text-gray-400"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
                        {PROMO_ACTIVE && tier.promoPriceUsd && <div className="flex justify-between text-green-400"><span>Promo Discount</span><span>-${(tier.priceUsd - tier.promoPriceUsd).toFixed(2)}</span></div>}
                        <div className="flex justify-between font-bold text-lg pt-1"><span>Total</span><span>${subtotal.toFixed(2)} USDC</span></div>
                        <div className="flex justify-between text-xs text-gray-500"><span>Your Balance</span><span>{user.balances.usdc.toFixed(2)} USDC</span></div>
                    </div>
                </div>

                <button 
                    onClick={() => hasEnoughBalance && onConfirm(quantity, currency)}
                    disabled={!hasEnoughBalance}
                    className="mt-4 w-full rounded-lg py-3 text-lg font-bold transition-all duration-300 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed bg-purple-600 text-white shadow-lg shadow-purple-500/30 hover:bg-purple-500"
                >
                    {hasEnoughBalance ? 'Confirm Mint' : 'Insufficient Balance'}
                </button>
            </div>
        </div>
    );
};


// --- Main Market Component ---

export default function Market() {
    const [user, setUser] = useState<User>({
        freeMintAvailable: true,
        invites: 1,
        referralUrl: 'https://basetc.xyz/invite/user123',
        balances: { usdc: 15.50, baseTC: 120.75 },
    });
    const [selectedTier, setSelectedTier] = useState<NFTTier | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    
    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleClaimFreeMint = () => {
        setUser(prev => ({ ...prev, freeMintAvailable: false }));
        showToast("Free Basic Rig claimed successfully!");
        // TODO: Add logic to add 1 Basic NFT to user inventory
    };

    const handleCopyInvite = () => {
        navigator.clipboard.writeText(user.referralUrl);
        showToast("Invite link copied!");
    };
    
    const handleConfirmMint = (qty: number, currency: Currency) => {
        console.log(`Minting ${qty} of ${selectedTier?.name} using ${currency}`);
        setSelectedTier(null);
        showToast(`${qty} ${selectedTier?.name} minted!`);
        // TODO: Add blockchain transaction logic here
    };

    return (
        <div className="mx-auto max-w-[430px] px-3 pb-4 pt-3 flex-grow flex flex-col gap-4">
            {toast && <Toast message={toast.message} type={toast.type} />}
            
            <header className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Icon path="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c.51 0 .962-.343 1.087-.835l.383-1.437M7.5 14.25L5.106 5.165A2.25 2.25 0 017.25 3h9.5a2.25 2.25 0 012.144 2.165L16.5 14.25" className="w-8 h-8 text-purple-400" />
                    <h1 className="text-xl font-bold">Market</h1>
                </div>
                {PROMO_ACTIVE && <div className="bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded-md">Promo Active!</div>}
            </header>
            
            {user.freeMintAvailable && <FreeMintBanner onClaim={handleClaimFreeMint} />}

            <ReferralPanel invites={user.invites} onCopy={handleCopyInvite} />

            <div className="border-t border-gray-700/50 my-2"></div>

            <div className="flex flex-col gap-4">
                {NFT_DATA.map(tier => (
                    <TierCard key={tier.id} tier={tier} onMint={() => setSelectedTier(tier)} />
                ))}
            </div>

            {selectedTier && (
                <MintModal 
                    tier={selectedTier} 
                    user={user}
                    onClose={() => setSelectedTier(null)} 
                    onConfirm={handleConfirmMint}
                />
            )}
        </div>
    );
}

// Tambahkan keyframes untuk animasi di file CSS global Anda (misal: app/globals.css)
/*
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes fade-in-down {
  from { opacity: 0; transform: translate(-50%, -20px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}
@keyframes slide-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
.animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
.animate-fade-in-down { animation: fade-in-down 0.3s ease-out forwards; }
.animate-slide-up { animation: slide-up 0.3s ease-out forwards; }
*/

