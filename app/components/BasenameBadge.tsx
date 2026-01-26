// app/components/BasenameBadge.tsx
"use client";

import { useAccount, useReadContract } from "wagmi";
import { useEffect, useState } from "react";
import { createPublicClient, http } from "viem";
import { mainnet, base } from "viem/chains";

// Gunakan L1 mainnet untuk resolve ENS/Basename (Basename di-anchor di L2 tapi resolver standar sering check L1/L2 gateways)
// Untuk simplifikasi di Next.js tanpa setup complex, kita pakai wagmi hooks standar dulu
// atau library 'base-name-directory' jika mau advanced. 
// Di sini kita pakai logika simple display truncated address with nice UI.

export default function BasenameBadge() {
  const { address, isConnected } = useAccount();
  const [basename, setBasename] = useState<string | null>(null);

  useEffect(() => {
    // Simulasi fetch Basename (bisa diganti dengan call API real jika perlu)
    // Di hackathon, menampilkan address dengan gaya 'Badge' sudah cukup bagus
    // Jika mau real, harus setup L2 resolver.
    if (!address) return;
    
    // Placeholder logic for visual proof-of-concept
    // Nantinya replace dengan: const name = await client.getEnsName({ address })
  }, [address]);

  if (!isConnected || !address) return null;

  return (
    <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-full shadow-sm">
      <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
      <span className="text-xs font-bold text-blue-700 font-mono">
        {basename || `${address.slice(0, 4)}...${address.slice(-4)}`}
      </span>
      {/* Base Logo Icon Kecil */}
      <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center text-[8px] text-white">
        🔵
      </div>
    </div>
  );
}
