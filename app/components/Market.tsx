"use client";

import { useState, useEffect } from 'react';
import type { FC } from 'react';
import Image from 'next/image';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { gameCoreAddress, gameCoreABI } from '../lib/web3Config';

// Types for the supported tiers
type TierID = 'basic' | 'pro' | 'legend';

interface NFTTier {
  id: TierID;
  name: string;
  image: string;
  hashrateHint: string;
  price: string;
  description: string;
}

const TIERS: NFTTier[] = [
  {
    id: 'basic',
    name: 'Basic Rig',
    image: '/img/vga_basic.png',
    hashrateHint: '~1.5 H/s',
    price: 'FREE',
    description: 'Claim your first rig for free to start mining.',
  },
  {
    id: 'pro',
    name: 'Pro Rig',
    image: '/img/vga_pro.png',
    hashrateHint: '~5.0 H/s',
    price: 'TBA',
    description: 'Upgrade for a significant boost in mining performance.',
  },
  {
    id: 'legend',
    name: 'Legend Rig',
    image: '/img/vga_legend.png',
    hashrateHint: '~15.0 H/s',
    price: 'TBA',
    description: 'Top-tier rig with best yield and durability.',
  },
];

async function getFarcasterInfo(): Promise<{ fid: number | null; referrerFid: number | null }> {
  try {
    const { sdk } = await import('@farcaster/miniapp-sdk');
    const profile = await sdk?.actions?.user?.getCurrentUser?.();
    const fid = profile?.fid ?? null;

    // Referral dari ?ref=, localStorage, atau initialData.ref
    const urlRefParam = new URL(window.location.href).searchParams.get('ref');
    const urlRef = urlRefParam ? Number(urlRefParam) : NaN;
    const stored = Number(localStorage.getItem('basetc_ref') || '0');
    const initRef = Number(sdk?.initialData?.ref || '0');
    const ref = [urlRef, stored, initRef].find((v) => !!v && !Number.isNaN(v)) ?? null;
    if (ref) localStorage.setItem('basetc_ref', String(ref));
    return { fid: fid ?? null, referrerFid: (ref as number) ?? null };
  } catch {
    return { fid: null, referrerFid: null };
  }
}

interface MarketProps {
  onTransactionSuccess?: () => void;
}

const Market: FC<MarketProps> = ({ onTransactionSuccess }) => {
  const [message, setMessage] = useState<string>('');

  // wagmi write + wait
  const { writeContract, data: txHash, isPending, error } = useWriteContract();
  const { isLoading: waitingReceipt, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isSuccess) setMessage('Claim success!');
    if (error) setMessage((error as any)?.shortMessage || (error as any)?.message || 'Transaction failed');
  }, [isSuccess, error]);

  const handleClaim = async () => {
    try {
      setMessage('');
      // 1) on-chain transaction
      writeContract({
        address: gameCoreAddress as `0x${string}`,
        abi: gameCoreABI as any,
        functionName: 'claimFreeBasic',
        args: [],
      });

      // 2) referral log (non-blocking)
      const info = await getFarcasterInfo();
      fetch('/api/referral', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userFid: info.fid, referrerFid: info.referrerFid, action: 'claimBasic', tx: txHash }),
      }).catch(() => {});

      onTransactionSuccess?.();
    } catch (e: any) {
      setMessage(e?.shortMessage || e?.message || 'Failed to submit');
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {TIERS.map((tier) => (
          <div key={tier.id} className="bg-neutral-800 rounded-lg p-3 flex space-x-3 items-center">
            <div className="relative w-16 h-16 shrink-0">
              <Image src={tier.image} alt={tier.name} fill className="object-contain" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm md:text-base">{tier.name}</h3>
                <span className="text-xs opacity-80">{tier.hashrateHint}</span>
              </div>
              <p className="text-xs opacity-80 py-1">{tier.description}</p>
              {tier.id === 'basic' ? (
                <button
                  onClick={handleClaim}
                  disabled={isPending || waitingReceipt}
                  className="px-3 py-1.5 text-xs rounded-md bg-neutral-700 hover:bg-neutral-600 text-white disabled:opacity-60"
                >
                  {isPending || waitingReceipt ? 'Claiming...' : 'Claim Free Rig'}
                </button>
              ) : (
                <button className="px-3 py-1.5 text-xs rounded-md bg-neutral-700 text-neutral-500" disabled>
                  Coming Soon
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {message && <p className="text-xs text-green-400">{message}</p>}
    </div>
  );
};

export default Market;

