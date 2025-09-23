"use client";

import { useState, useEffect } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { gameCoreABI, gameCoreAddress } from '../lib/web3Config';
import type { FC } from 'react';

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

// Dummy data for each tier. Replace image paths with actual assets in /public/img
const NFT_DATA: NFTTier[] = [
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
    description: 'Upgrade for a significant boost in hashrate.',
  },
  {
    id: 'legend',
    name: 'Legend Rig',
    image: '/img/vga_legend.png',
    hashrateHint: '~25.0 H/s',
    price: 'TBA',
    description: 'The ultimate rig for professional miners.',
  },
];

export interface MarketProps {
  onTransactionSuccess?: () => void;
}

/**
 * Market component lists available NFT rigs. Only the Basic tier can be
 * claimed for free; other tiers are coming soon. When the user claims a
 * free rig a callback is triggered (if provided) and a success message is
 * displayed.
 */
const Market: FC<MarketProps> = ({ onTransactionSuccess }) => {
  const [message, setMessage] = useState<string>('');

  // Prepare the writeContract hook from wagmi. It will allow us to
  // invoke the claimFreeBasic function on the GameCore contract. We
  // also track the transaction status using useWaitForTransactionReceipt.
  const { writeContract, data: txHash, isPending, error } = useWriteContract();
  const { isLoading: waitingReceipt, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  // Once the transaction is mined or fails, update the message accordingly.
  useEffect(() => {
    if (isSuccess) setMessage('Claim success!');
    if (error) {
      const err: any = error;
      setMessage(err?.shortMessage || err?.message || 'Transaction failed');
    }
  }, [isSuccess, error]);

  // Retrieve Farcaster user and referrer FID information. This helper
  // dynamically imports the miniapp SDK to avoid build‑time errors. It
  // attempts to read the referrer FID from the URL (?ref=) or
  // localStorage, falling back to sdk.initialData.ref if present.
async function getFarcasterInfo(): Promise<{ fid: number | null; referrerFid: number | null }> {
  try {
    const mod = await import('@farcaster/miniapp-sdk');
    const fid = mod.sdk?.context?.user?.fid ?? null;

    // Referral dari ?ref= atau localStorage (tetap seperti sebelumnya)
    const urlRefParam = new URL(window.location.href).searchParams.get('ref');
    const urlRef = urlRefParam ? Number(urlRefParam) : NaN;
    const stored = Number(localStorage.getItem('basetc_ref') || '0');

    const ref = [urlRef, stored].find((v) => !!v && !Number.isNaN(v)) ?? null;
    if (ref) localStorage.setItem('basetc_ref', String(ref));

    return { fid, referrerFid: (ref as number) ?? null };
  } catch {
    return { fid: null, referrerFid: null };
  }
}

  const handleClaim = async () => {
    try {
      // Reset any previous message
      setMessage('');
      // Initiate the transaction on the GameCore contract. This prompts
      // the connected wallet (via Farcaster) to sign and submit the tx.
      writeContract({
        address: gameCoreAddress as `0x${string}`,
        abi: gameCoreABI as any,
        functionName: 'claimFreeBasic',
        args: [],
      });
      // Off‑chain: record referral data for analytics/leaderboard.
      try {
        const info = await getFarcasterInfo();
        fetch('/api/referral', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            userFid: info.fid,
            referrerFid: info.referrerFid,
            action: 'claimBasic',
            tx: txHash,
          }),
        }).catch(() => {});
      } catch {}
      onTransactionSuccess?.();
    } catch (err: any) {
      const msg = err?.shortMessage || err?.message || 'Transaction failed';
      setMessage(msg);
    }
  };

  return (
    <div className="space-y-4 px-4 pt-4 pb-8">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Market</h1>
        <p className="text-sm text-neutral-400">Mint &amp; Listings</p>
      </header>
      <div className="space-y-4">
        {NFT_DATA.map((tier) => (
          <div
            key={tier.id}
            className="flex items-center bg-neutral-800 rounded-lg p-3 space-x-3"
          >
            {/* Image placeholder */}
            <div className="w-16 h-16 bg-neutral-700 rounded-md flex items-center justify-center">
              {/* Use next/image for optimization when actual images available */}
              <span className="text-xs text-neutral-400">Img</span>
            </div>
            <div className="flex-1">
              <div className="flex items-baseline justify-between">
                <h3 className="font-semibold text-sm md:text-base">{tier.name}</h3>
                <span className="text-xs md:text-sm text-neutral-400">{tier.price}</span>
              </div>
              <p className="text-xs text-neutral-400 pt-0.5">{tier.description}</p>
              <p className="text-xs text-neutral-400 pt-0.5">Est. Hashrate: {tier.hashrateHint}</p>
            </div>
            <div>
            {tier.id === 'basic' ? (
              <button
                onClick={handleClaim}
                disabled={isPending || waitingReceipt}
                className="px-3 py-1.5 text-xs rounded-md bg-neutral-700 hover:bg-neutral-600 text-white disabled:bg-neutral-700 disabled:text-neutral-500"
              >
                {isPending || waitingReceipt ? 'Claiming…' : 'Claim Free Rig'}
              </button>
            ) : (
              <button
                disabled
                className="px-3 py-1.5 text-xs rounded-md bg-neutral-700 text-neutral-500"
              >
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
