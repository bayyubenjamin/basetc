"use client";

import { useState } from 'react';
import type { FC } from 'react';

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

  // Convert 10 Basic rigs into 1 Pro rig
  const convertBasicToPro = () => {
    if (basicCount >= 10) {
      setBasicCount((c) => c - 10);
      setProCount((c) => c + 1);
      setMessage('Successfully merged 10 Basic rigs into 1 Pro rig!');
    }
  };

  // Convert 5 Pro rigs into 1 Legend rig
  const convertProToLegend = () => {
    if (proCount >= 5) {
      setProCount((c) => c - 5);
      setLegendCount((c) => c + 1);
      setMessage('Successfully merged 5 Pro rigs into 1 Legend rig!');
    }
  };

  const unlockSlot = () => {
    setMessage('Slot unlocked! You can now equip an extra GPU.');
  };

  return (
    <div className="space-y-4 px-4 pt-4 pb-8">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Workshop / Rakit</h1>
        <p className="text-sm text-neutral-400">Upgrade &amp; Merge your rigs</p>
      </header>

      {/* Inventory counts */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs md:text-sm">
        <div className="bg-neutral-800 rounded-lg p-2">
          <div className="text-neutral-400">Basic</div>
          <div className="text-lg font-semibold">x{basicCount}</div>
        </div>
        <div className="bg-neutral-800 rounded-lg p-2">
          <div className="text-neutral-400">Pro</div>
          <div className="text-lg font-semibold">x{proCount}</div>
        </div>
        <div className="bg-neutral-800 rounded-lg p-2">
          <div className="text-neutral-400">Legend</div>
          <div className="text-lg font-semibold">x{legendCount}</div>
        </div>
      </div>

      {/* Merge actions */}
      <div className="space-y-2">
        <button
          onClick={convertBasicToPro}
          disabled={basicCount < 10}
          className={`w-full px-3 py-2 text-xs rounded-md ${basicCount < 10 ? 'bg-neutral-700 text-neutral-500' : 'bg-neutral-700 hover:bg-neutral-600 text-white'}`}
        >
          10 Basic → 1 Pro
        </button>
        <button
          onClick={convertProToLegend}
          disabled={proCount < 5}
          className={`w-full px-3 py-2 text-xs rounded-md ${proCount < 5 ? 'bg-neutral-700 text-neutral-500' : 'bg-neutral-700 hover:bg-neutral-600 text-white'}`}
        >
          5 Pro → 1 Legend
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