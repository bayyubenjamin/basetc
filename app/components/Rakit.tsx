"use client";

import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { gameCoreAddress, gameCoreABI } from '../lib/web3Config';

/**
 * The Rakit (workshop) component allows users to manage and upgrade their
 * NFT rigs. Users can see how many Basic, Pro and Legend rigs they own and
 * perform merge operations (10 Basic → 1 Pro, 5 Pro → 1 Legend). An action
 * button provides a placeholder for unlocking additional GPU slots on a rig.
 */
const Rakit: FC = () => {
  const [basicCount, setBasicCount] = useState<number>(7);
  const [proCount, setProCount] = useState<number>(2);
  const [legendCount, setLegendCount] = useState<number>(0);
  const [message, setMessage] = useState<string>('');

  const { writeContract, data: txHash, isPending, error } = useWriteContract();
  const { isLoading: waitingReceipt, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isSuccess) setMessage('Merge success!');
    if (error) setMessage((error as any)?.shortMessage || (error as any)?.message || 'Transaction failed');
  }, [isSuccess, error]);

  const convertBasicToPro = () => {
    if (basicCount < 10) return;
    setMessage('');
    writeContract({
      address: gameCoreAddress as `0x${string}`,
      abi: gameCoreABI as any,
      functionName: 'mergeToPro',
      args: [],
    });
  };

  const convertProToLegend = () => {
    if (proCount < 5) return;
    setMessage('');
    writeContract({
      address: gameCoreAddress as `0x${string}`,
      abi: gameCoreABI as any,
      functionName: 'mergeToLegend',
      args: [],
    });
  };

  const unlockSlot = () => {
    setMessage('Slot unlock requested (coming soon).');
  };

  return (
    <div className="space-y-3">
      {/* Current inventory overview */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-neutral-800 rounded-lg p-3 text-center">
          <div className="text-xs opacity-80">Basic</div>
          <div className="font-semibold text-xl">{basicCount}</div>
        </div>
        <div className="bg-neutral-800 rounded-lg p-3 text-center">
          <div className="text-xs opacity-80">Pro</div>
          <div className="font-semibold text-xl">{proCount}</div>
        </div>
        <div className="bg-neutral-800 rounded-lg p-3 text-center">
          <div className="text-xs opacity-80">Legend</div>
          <div className="font-semibold text-xl">{legendCount}</div>
        </div>
      </div>

      {/* Merge actions */}
      <div className="space-y-2">
        <button
          onClick={convertBasicToPro}
          disabled={isPending || waitingReceipt || basicCount < 10}
          className={`w-full px-3 py-2 text-xs rounded-md ${basicCount < 10 ? 'bg-neutral-700 text-neutral-500' : 'bg-neutral-700 hover:bg-neutral-600 text-white'}`}
        >
          {isPending || waitingReceipt ? 'Merging...' : '10 Basic → 1 Pro'}
        </button>
        <button
          onClick={convertProToLegend}
          disabled={isPending || waitingReceipt || proCount < 5}
          className={`w-full px-3 py-2 text-xs rounded-md ${proCount < 5 ? 'bg-neutral-700 text-neutral-500' : 'bg-neutral-700 hover:bg-neutral-600 text-white'}`}
        >
          {isPending || waitingReceipt ? 'Merging...' : '5 Pro → 1 Legend'}
        </button>
        <button
          onClick={unlockSlot}
          className="w-full px-3 py-2 text-xs rounded-md bg-neutral-700 hover:bg-neutral-600 text-white"
        >
          Unlock Slot
        </button>
      </div>

      {message && <p className="text-xs text-green-400 pt-2">{message}</p>}
    </div>
  );
};

export default Rakit;

