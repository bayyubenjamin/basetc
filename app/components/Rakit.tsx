"use client";
import { FC } from "react";
import Image from 'next/image';
import { TabName, Nft } from "../page";

// (Asumsi tipe data dan config sama)
type NftTier = "Basic" | "Pro" | "Legend";

export default function Rakit({ inventory, setActiveTab }: { inventory: Nft[], setActiveTab: (tab: TabName) => void }) {
  const tiers: NftTier[] = ["Basic", "Pro", "Legend"];

  return (
    <div className="space-y-3">
      {tiers.map(tier => {
        const owned = inventory.filter(n => n.tier === tier);
        const maxSlots = tier === 'Basic' ? 10 : tier === 'Pro' ? 5 : 3;
        
        return (
          <section key={tier} className="panel">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold">{tier} Rigs</h2>
              <p className="text-xs text-text-muted">{owned.length}/{maxSlots} Slots</p>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {owned.map(nft => (
                <div key={nft.id} className="aspect-square bg-black/20 rounded-lg overflow-hidden border border-edge">
                  <Image src={nft.img} alt={nft.name} width={100} height={100} className="object-cover w-full h-full"/>
                </div>
              ))}
              {Array.from({ length: maxSlots - owned.length }).map((_, i) => (
                <button key={i} onClick={() => setActiveTab('market')} className="aspect-square bg-black/10 rounded-lg border-2 border-dashed border-edge flex items-center justify-center text-text-muted hover:bg-edge transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
