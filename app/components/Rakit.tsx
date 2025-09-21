"use client";
import { useState, useMemo, FC, ReactNode } from "react";
import Image from 'next/image';
import { TabName } from "../page"; // Impor tipe dari page.tsx

// --- Types & Initial Data ---

type NftTier = "Basic" | "Pro" | "Legend";

interface Nft {
  id: number;
  tier: NftTier;
  name: string;
  img: string;
  durability: number;
}

const initialInventory: Nft[] = [
  ...Array.from({ length: 4 }, (_, i) => ({ id: 100 + i, tier: "Basic" as NftTier, name: `Basic Rig #${i+1}`, img: "/img/vga_basic.png", durability: Math.floor(Math.random() * 30) + 70 })),
  ...Array.from({ length: 1 }, (_, i) => ({ id: 200 + i, tier: "Pro" as NftTier, name: `Pro Rig #${i+1}`, img: "/img/vga_pro.png", durability: Math.floor(Math.random() * 20) + 80 })),
];

const TIER_CONFIG = {
  Basic: { maxSlots: 10, img: "/img/vga_basic.png" },
  Pro: { maxSlots: 5, img: "/img/vga_pro.png" },
  Legend: { maxSlots: 3, img: "/img/vga_legend.png" },
};

// --- Helper Components ---

const Icon: FC<{ path: string; className?: string }> = ({ path, className = "w-5 h-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
);

const Toast: FC<{ message: string }> = ({ message }) => (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-green-500/90 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-lg animate-fade-in-down z-50">
        {message}
    </div>
);

// --- UI Components ---

const NftSlot: FC<{ nft: Nft | null, onSlotClick: () => void }> = ({ nft, onSlotClick }) => {
    if (nft) {
        return (
            <div className="relative rounded-lg border-2 border-gray-700 bg-gray-800 p-2">
                <Image src={nft.img} alt={nft.name} width={100} height={100} className="w-full rounded-md object-cover aspect-square" />
                <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-full text-xs font-bold">
                    {nft.tier}
                </div>
                <div className="w-full bg-gray-600 rounded-full h-1.5 mt-2">
                    <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${nft.durability}%` }}></div>
                </div>
            </div>
        );
    }

    return (
        <div 
            onClick={onSlotClick}
            className="relative rounded-lg border-2 border-dashed border-gray-600 bg-gray-900/50 flex items-center justify-center aspect-square cursor-pointer hover:bg-gray-800/70 hover:border-cyan-400 transition-colors"
        >
            <div className="w-8 h-8 text-gray-500">+</div>
        </div>
    );
};

const AcquireSlotModal: FC<{ tier: NftTier; onClose: () => void; setActiveTab: (tab: TabName) => void; onMerge: () => void; onInvite: () => void; }> = ({ tier, onClose, setActiveTab, onMerge, onInvite }) => {
    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end justify-center z-40 animate-fade-in">
            <div className="relative bg-gradient-to-b from-[#0f1622] to-[#0b1118] w-full max-w-[430px] rounded-t-2xl border-t border-gray-700 p-4 animate-slide-up">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white">
                    <Icon path="M6 18L18 6M6 6l12 12" />
                </button>
                
                <h2 className="text-2xl font-bold text-center mb-4">Get a {tier} Rig</h2>
                <div className="space-y-3">
                    <button 
                        onClick={() => setActiveTab('market')}
                        className="w-full text-left flex items-center gap-4 p-3 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
                    >
                        <Icon path="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c.51 0 .962-.343 1.087-.835l.383-1.437M7.5 14.25L5.106 5.165A2.25 2.25 0 017.25 3h9.5a2.25 2.25 0 012.144 2.165L16.5 14.25" className="w-8 h-8 text-purple-400"/>
                        <div>
                            <p className="font-bold">Buy from Market</p>
                            <p className="text-xs text-gray-400">Purchase a new rig directly from the market.</p>
                        </div>
                    </button>
                    
                    {tier === 'Basic' && (
                         <button onClick={onInvite} className="w-full text-left flex items-center gap-4 p-3 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors">
                            <Icon path="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m-7.5-2.962a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM3.375 19.5a3 3 0 013-3h1.5m0 0a3.75 3.75 0 017.5 0" className="w-8 h-8 text-green-400"/>
                            <div>
                                <p className="font-bold">Invite Friends</p>
                                <p className="text-xs text-gray-400">Get a free rig by inviting 3 friends.</p>
                            </div>
                        </button>
                    )}

                    {(tier === 'Pro' || tier === 'Legend') && (
                        <button onClick={onMerge} className="w-full text-left flex items-center gap-4 p-3 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors">
                            <Icon path="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.438.995s.145.755.438.995l1.003.827c.481.398.668 1.04.26 1.431l-1.296 2.247a1.125 1.125 0 01-1.37.49l-1.217-.456c-.355-.133-.75-.072-1.075.124a6.57 6.57 0 01-.22.127c-.332.183-.582.495-.645.87l-.213 1.281c-.09.543-.56.94-1.11.94h-2.593c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.063-.374-.313-.686-.645-.87a6.52 6.52 0 01-.22-.127c-.324-.196-.72-.257-1.075-.124l-1.217.456a1.125 1.125 0 01-1.37-.49l-1.296-2.247a1.125 1.125 0 01.26-1.431l1.003-.827c.293-.24.438-.613.438-.995s-.145-.755-.438-.995l-1.003-.827a1.125 1.125 0 01-.26-1.431l1.296-2.247a1.125 1.125 0 011.37-.49l1.217.456c.355.133.75.072 1.075-.124.073-.044.146-.087.22-.127.332-.183.582-.495.645-.87l.213-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z" className="w-8 h-8 text-cyan-400"/>
                             <div>
                                <p className="font-bold">Merge Rigs</p>
                                <p className="text-xs text-gray-400">
                                    {tier === 'Pro' ? 'Merge 10 Basic Rigs to create a Pro Rig.' : 'Merge 5 Pro Rigs to create a Legend Rig.'}
                                </p>
                            </div>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};


// --- Komponen Utama Rakit ---

export default function Rakit({ setActiveTab }: { setActiveTab: (tab: TabName) => void }) {
  const [inventory, setInventory] = useState<Nft[]>(initialInventory);
  const [modalTier, setModalTier] = useState<NftTier | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };
  
  const handleSlotClick = (tier: NftTier) => {
    setModalTier(tier);
  };

  const Tiers: NftTier[] = ["Basic", "Pro", "Legend"];

  return (
    <div className="mx-auto max-w-[430px] px-3 pb-4 pt-3 flex-grow flex flex-col gap-4">
        {toastMessage && <Toast message={toastMessage} />}

        {modalTier && (
            <AcquireSlotModal 
                tier={modalTier}
                onClose={() => setModalTier(null)}
                setActiveTab={setActiveTab}
                onMerge={() => showToast("Fungsi merge akan datang!")}
                onInvite={() => showToast("Fungsi invite akan datang!")}
            />
        )}
        
        {/* Header */}
        <header className="flex items-center gap-3">
            <Icon path="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.438.995s.145.755.438.995l1.003.827c.481.398.668 1.04.26 1.431l-1.296 2.247a1.125 1.125 0 01-1.37.49l-1.217-.456c-.355-.133-.75-.072-1.075.124a6.57 6.57 0 01-.22.127c-.332.183-.582.495-.645.87l-.213 1.281c-.09.543-.56.94-1.11.94h-2.593c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.063-.374-.313-.686-.645-.87a6.52 6.52 0 01-.22-.127c-.324-.196-.72-.257-1.075-.124l-1.217.456a1.125 1.125 0 01-1.37-.49l-1.296-2.247a1.125 1.125 0 01.26-1.431l1.003-.827c.293-.24.438-.613.438.995s-.145-.755-.438-.995l-1.003-.827a1.125 1.125 0 01-.26-1.431l1.296-2.247a1.125 1.125 0 011.37-.49l1.217.456c.355.133.75.072 1.075-.124.073-.044.146-.087.22-.127.332-.183.582-.495.645-.87l.213-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z" className="w-8 h-8 text-cyan-400" />
            <div>
                <h1 className="text-xl font-bold leading-tight">My Rigs Workshop</h1>
                <p className="text-xs text-gray-400">View your owned rigs and fill empty slots.</p>
            </div>
        </header>

        {/* Rig Slots Grouped by Tier */}
        <div className="flex-grow space-y-4 overflow-y-auto no-scrollbar pr-1">
            {Tiers.map(tier => {
                const ownedNfts = inventory.filter(nft => nft.tier === tier);
                const config = TIER_CONFIG[tier];
                const totalSlots = Array.from({ length: config.maxSlots });

                return (
                    <section key={tier}>
                        <h2 className="font-semibold mb-2 text-lg">{tier} Rigs ({ownedNfts.length}/{config.maxSlots})</h2>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {totalSlots.map((_, index) => (
                                <NftSlot 
                                    key={index}
                                    nft={ownedNfts[index] || null}
                                    onSlotClick={() => handleSlotClick(tier)}
                                />
                            ))}
                        </div>
                    </section>
                );
            })}
        </div>
    </div>
  );
}

// Jangan lupa tambahkan keyframes animasi ke app/globals.css jika belum ada
/*
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes fade-in-down { from { opacity: 0; transform: translate(-50%, -20px); } to { opacity: 1; transform: translate(-50%, 0); } }
@keyframes slide-up { from { transform: translateY(100%); } to { translateY(0); } }
.animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
.animate-fade-in-down { animation: fade-in-down 0.3s ease-out forwards; }
.animate-slide-up { animation: slide-up 0.3s ease-out forwards; }
*/
