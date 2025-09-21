"use client";
import { useState, useMemo, FC, ReactNode } from "react";
import Image from 'next/image';

// --- Types & Initial Data (untuk simulasi) ---

type NftTier = "Basic" | "Pro" | "Legend";

interface Nft {
  id: number;
  tier: NftTier;
  name: string;
  img: string;
  durability: number;
}

// --- PERUBAHAN DI SINI ---
// Path gambar diubah untuk menunjuk ke gambar VGA spesifik
const initialInventory: Nft[] = [
  ...Array.from({ length: 8 }, (_, i) => ({ id: 100 + i, tier: "Basic" as NftTier, name: `Basic Rig #${i+1}`, img: "/img/vga_basic.png", durability: Math.floor(Math.random() * 30) + 70 })),
  ...Array.from({ length: 2 }, (_, i) => ({ id: 200 + i, tier: "Pro" as NftTier, name: `Pro Rig #${i+1}`, img: "/img/vga_pro.png", durability: Math.floor(Math.random() * 20) + 80 })),
];

const MERGE_CONFIG = {
  Basic: { requires: 10, cost: 50, produces: "Pro", img: "/img/vga_pro.png" },
  Pro: { requires: 5, cost: 250, produces: "Legend", img: "/img/vga_legend.png" },
};
// --- AKHIR PERUBAHAN ---

// --- Sub-Komponen ---

const Icon: FC<{ path: string; className?: string }> = ({ path, className = "w-5 h-5" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
);

const NftCard: FC<{ nft: Nft; onSelect: () => void; isSelected: boolean; isSelectable: boolean }> = ({ nft, onSelect, isSelected, isSelectable }) => (
    <div 
        onClick={isSelectable ? onSelect : undefined} 
        className={`relative rounded-lg border-2 p-2 transition-all duration-200 ${
            isSelected ? 'border-cyan-400 bg-cyan-500/10 scale-105 shadow-lg shadow-cyan-500/20' : 
            isSelectable ? 'border-gray-700 bg-gray-800 hover:border-cyan-500 cursor-pointer' : 
            'border-gray-800 bg-gray-900/50 opacity-50 cursor-not-allowed'
        }`}
    >
        <Image src={nft.img} alt={nft.name} width={100} height={100} className="w-full rounded-md object-cover aspect-square" />
        <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-full text-xs font-bold">
            {nft.tier}
        </div>
        <div className="w-full bg-gray-600 rounded-full h-1.5 mt-2">
            <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${nft.durability}%` }}></div>
        </div>
    </div>
);

const MergeSlot: FC<{ nft: Nft | null }> = ({ nft }) => (
    <div className="relative w-16 h-16 rounded-lg border-2 border-dashed border-gray-600 bg-gray-900/50 flex items-center justify-center">
        {nft ? (
            <Image src={nft.img} alt={nft.name} width={64} height={64} className="p-1 animate-fade-in" />
        ) : (
            <div className="w-4 h-4 text-gray-600">+</div>
        )}
    </div>
);

// --- Komponen Utama Rakit ---

export default function Rakit() {
  const [inventory, setInventory] = useState<Nft[]>(initialInventory);
  const [selectedNfts, setSelectedNfts] = useState<number[]>([]);
  const [notification, setNotification] = useState<string | null>(null);

  const selectedTier = useMemo(() => {
    if (selectedNfts.length === 0) return null;
    return inventory.find(nft => nft.id === selectedNfts[0])?.tier || null;
  }, [selectedNfts, inventory]);

  const config = selectedTier ? MERGE_CONFIG[selectedTier as keyof typeof MERGE_CONFIG] : null;

  const handleSelectNft = (nftId: number) => {
    const nft = inventory.find(n => n.id === nftId);
    if (!nft) return;

    // Jika belum ada yang dipilih atau memilih tier yang sama
    if (selectedNfts.length === 0 || nft.tier === selectedTier) {
      setSelectedNfts(prev => 
        prev.includes(nftId) ? prev.filter(id => id !== nftId) : [...prev, nftId]
      );
    } else {
      // Jika memilih tier yang berbeda, reset dan pilih yang baru
      setSelectedNfts([nftId]);
    }
  };

  const handleMerge = () => {
    if (!config || selectedNfts.length !== config.requires) {
        showNotification("Error: Jumlah NFT tidak sesuai.", "error");
        return;
    }
    
    // 1. Hapus NFT yang di-merge dari inventory
    const newInventory = inventory.filter(nft => !selectedNfts.includes(nft.id));
    
    // 2. Tambahkan NFT hasil merge
    newInventory.unshift({
        id: Date.now(), // ID unik baru
        tier: config.produces as NftTier,
        name: `${config.produces} Rig #${Math.floor(Math.random() * 100)}`,
        img: config.img,
        durability: 100
    });
    
    setInventory(newInventory);
    setSelectedNfts([]);
    showNotification(`Merge berhasil! Kamu mendapatkan 1 ${config.produces} Rig.`);
  };

  const showNotification = (message: string, type: "success" | "error" = "success") => {
      setNotification(message);
      setTimeout(() => setNotification(null), 3000);
  };

  const canMerge = config && selectedNfts.length === config.requires;

  return (
    <div className="mx-auto max-w-[430px] px-3 pb-4 pt-3 flex-grow flex flex-col gap-4">
        {/* Notifikasi Pop-up */}
        {notification && (
            <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-green-500/90 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-lg animate-fade-in-down z-50">
                {notification}
            </div>
        )}

        {/* 1. Header */}
        <header className="flex items-center gap-3">
            <Icon path="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.438.995s.145.755.438.995l1.003.827c.481.398.668 1.04.26 1.431l-1.296 2.247a1.125 1.125 0 01-1.37.49l-1.217-.456c-.355-.133-.75-.072-1.075.124a6.57 6.57 0 01-.22.127c-.332.183-.582.495-.645.87l-.213 1.281c-.09.543-.56.94-1.11.94h-2.593c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.063-.374-.313-.686-.645-.87a6.52 6.52 0 01-.22-.127c-.324-.196-.72-.257-1.075-.124l-1.217.456a1.125 1.125 0 01-1.37-.49l-1.296-2.247a1.125 1.125 0 01.26-1.431l1.003-.827c.293-.24.438-.613-.438.995s-.145-.755-.438-.995l-1.003-.827a1.125 1.125 0 01-.26-1.431l1.296-2.247a1.125 1.125 0 011.37-.49l1.217.456c.355.133.75.072 1.075-.124.073-.044.146-.087.22-.127.332-.183.582-.495.645-.87l.213-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z" className="w-8 h-8 text-cyan-400" />
            <div>
                <h1 className="text-xl font-bold leading-tight">Workshop</h1>
                <p className="text-xs text-gray-400">Merge, upgrade, and repair your rigs here.</p>
            </div>
        </header>

        {/* 2. Merge Panel */}
        <section className="rounded-xl border border-[#202838] bg-gradient-to-b from-[#0f1622] to-[#0c1119] p-3 space-y-3">
            <h2 className="text-center font-semibold text-lg">Rig Fusion Chamber</h2>
            <div className="flex justify-center items-center gap-2 flex-wrap">
                {config ? Array.from({ length: config.requires }).map((_, i) => (
                    <MergeSlot key={i} nft={selectedNfts[i] ? inventory.find(n => n.id === selectedNfts[i])! : null} />
                )) : <p className="text-gray-500 text-sm py-4">Pilih NFT dari inventory untuk memulai merge.</p>}
            </div>
            {config && (
                <div className="text-center space-y-2 pt-2">
                    <div className="flex justify-center items-center gap-4 text-sm">
                        <span>Biaya Merge: <strong className="text-yellow-400">{config.cost} $BaseTC</strong></span>
                        <span>Hasil: <strong className="text-cyan-400">1x {config.produces} Rig</strong></span>
                    </div>
                    <button 
                        onClick={handleMerge}
                        disabled={!canMerge}
                        className={`w-full rounded-lg py-3 text-lg font-bold transition-all duration-300 ${
                            canMerge ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30 hover:bg-cyan-400' :
                            'bg-gray-700 text-gray-500 cursor-not-allowed'
                        }`}
                    >
                        {canMerge ? "MERGE NOW" : `Pilih ${config.requires} ${selectedTier} NFT`}
                    </button>
                </div>
            )}
        </section>

        {/* 3. Inventory */}
        <section className="flex-grow flex flex-col">
            <h2 className="font-semibold mb-2">My Inventory ({inventory.length})</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 overflow-y-auto no-scrollbar flex-grow pr-1">
                {inventory.map(nft => (
                    <NftCard 
                        key={nft.id} 
                        nft={nft} 
                        onSelect={() => handleSelectNft(nft.id)}
                        isSelected={selectedNfts.includes(nft.id)}
                        isSelectable={selectedTier === null || nft.tier === selectedTier}
                    />
                ))}
            </div>
        </section>
    </div>
  );
}
