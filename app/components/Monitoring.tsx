"use client";

import { useState, useEffect, useMemo } from 'react';
import React from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import {
  baseTcAddress, baseTcABI,
  rigNftAddress, rigNftABI,
  gameCoreAddress, gameCoreABI
} from '../lib/web3Config';

/**
 * Monitoring component displays real-time mining status, including current
 * hashrate, yield, uptime, temperatures, power usage and a log of events.
 * Button handlers are wired to on-chain functions when available.
 */
export default function Monitoring() {
  const [mining, setMining] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  // Simulated metrics for demonstration. In a real implementation these
  // would come from on-chain data or backend services.
  const [hashRate, setHashRate] = useState(1.23);
  const [uptime, setUptime] = useState(0);

  // On-chain reads
  const { address } = useAccount();

  // pending reward (optional on your contract)
  const { data: pending } = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: 'pendingReward',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  // token balance
  const { data: baseBal } = useReadContract({
    address: baseTcAddress as `0x${string}`,
    abi: baseTcABI as any,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  // ERC1155 balances for rigs (assumed ids: 1 Basic, 2 Pro, 3 Legend)
  const { data: basicBal } = useReadContract({
    address: rigNftAddress as `0x${string}`,
    abi: rigNftABI as any,
    functionName: 'balanceOf',
    args: address ? [address, 1n] : undefined,
    query: { enabled: Boolean(address) },
  });
  const { data: proBal } = useReadContract({
    address: rigNftAddress as `0x${string}`,
    abi: rigNftABI as any,
    functionName: 'balanceOf',
    args: address ? [address, 2n] : undefined,
    query: { enabled: Boolean(address) },
  });
  const { data: legendBal } = useReadContract({
    address: rigNftAddress as `0x${string}`,
    abi: rigNftABI as any,
    functionName: 'balanceOf',
    args: address ? [address, 3n] : undefined,
    query: { enabled: Boolean(address) },
  });

  const pendingReadable = useMemo(() => (pending ? Number(pending as any) / 1e18 : 0), [pending]);
  const tokenReadable = useMemo(() => (baseBal ? Number(baseBal as any) / 1e18 : 0), [baseBal]);

  // Update uptime every second when mining is active
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (mining) {
      interval = setInterval(() => {
        setUptime((s) => s + 1);
        setHashRate((h) => Math.max(0, h + (Math.random() * 0.4 - 0.2)));
        if (Math.random() < 0.1) {
          setLogs((l) => [`[INFO] Share submitted`, ...l.slice(0, 99)]);
        }
      }, 1000);
    } else {
      setHashRate(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [mining]);

  const uptimeHms = useMemo(() => {
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);
    const s = uptime % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, [uptime]);

  // (Optional) map to on-chain control functions if they exist
  const { writeContract, data: ctrlTx, isPending: ctrlPending, error: ctrlError } = useWriteContract();
  const { isLoading: ctrlWaiting, isSuccess: ctrlOk } = useWaitForTransactionReceipt({ hash: ctrlTx });

  useEffect(() => {
    if (ctrlError) setLogs((l) => [`[ERROR] ${ (ctrlError as any)?.shortMessage || (ctrlError as any)?.message || 'tx failed' }`, ...l]);
    if (ctrlOk) setLogs((l) => [`[OK] Rig action executed`, ...l]);
  }, [ctrlError, ctrlOk]);

  const handleStart = () => {
    setMining(true);
    setLogs((l) => [`[OK] Miner started`, ...l]);
    // Example if your contract has such function:
    // writeContract({ address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: 'startMining' });
  };

  const handleStop = () => {
    setMining(false);
    setLogs((l) => [`[INFO] Miner stopped`, ...l]);
    // Example: pause if your contract supports it
    // writeContract({ address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: 'pauseMining' });
  };

  const GPUs = [
    { id: 1, hashrate: `${(hashRate / 4).toFixed(2)} H/s`, temp: '63°C', fan: '58%' },
    { id: 2, hashrate: `${(hashRate / 4).toFixed(2)} H/s`, temp: '66°C', fan: '61%' },
    { id: 3, hashrate: `${(hashRate / 4).toFixed(2)} H/s`, temp: '64°C', fan: '55%' },
    { id: 4, hashrate: `${(hashRate / 4).toFixed(2)} H/s`, temp: '65°C', fan: '59%' },
  ];

  return (
    <div className="space-y-3">
      {/* Status + Controls */}
      <div className="bg-neutral-800 rounded-lg p-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className={`w-2.5 h-2.5 rounded-full ${mining ? 'bg-green-400' : 'bg-neutral-500'}`} />
          <span className="text-sm font-medium">{mining ? 'Mining' : 'Stopped'}</span>
        </div>
        <div className="space-x-2">
          {!mining ? (
            <button onClick={handleStart} className="px-3 py-1.5 text-xs rounded-md bg-neutral-700 hover:bg-neutral-600 text-white">
              Start
            </button>
          ) : (
            <button onClick={handleStop} className="px-3 py-1.5 text-xs rounded-md bg-neutral-700 hover:bg-neutral-600 text-white">
              Stop
            </button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-neutral-800 rounded-lg p-3 text-center">
          <div className="text-xs opacity-80">Active Miners</div>
          <div className="font-semibold text-xl">{mining ? 1 : 0}</div>
        </div>
        <div className="bg-neutral-800 rounded-lg p-3 text-center">
          <div className="text-xs opacity-80">24h Yield</div>
          <div className="font-semibold text-xl">{pendingReadable.toFixed(3)} $BaseTC</div>
        </div>
        <div className="bg-neutral-800 rounded-lg p-3 text-center">
          <div className="text-xs opacity-80">Uptime</div>
          <div className="font-semibold text-xl">{uptimeHms}</div>
        </div>
      </div>

      {/* Token & rigs overview */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-neutral-800 rounded-lg p-3 text-center">
          <div className="text-xs opacity-80">$BaseTC</div>
          <div className="font-semibold text-lg">{tokenReadable.toFixed(3)}</div>
        </div>
        <div className="bg-neutral-800 rounded-lg p-3 text-center">
          <div className="text-xs opacity-80">Basic</div>
          <div className="font-semibold text-lg">{String(basicBal ?? 0)}</div>
        </div>
        <div className="bg-neutral-800 rounded-lg p-3 text-center">
          <div className="text-xs opacity-80">Pro</div>
          <div className="font-semibold text-lg">{String(proBal ?? 0)}</div>
        </div>
        <div className="bg-neutral-800 rounded-lg p-3 text-center">
          <div className="text-xs opacity-80">Legend</div>
          <div className="font-semibold text-lg">{String(legendBal ?? 0)}</div>
        </div>
      </div>

      {/* Live hashrate */}
      <div className="bg-neutral-800 rounded-lg p-3">
        <div className="text-xs opacity-80">Hashrate</div>
        <div className="font-semibold text-xl">{hashRate.toFixed(2)} H/s</div>
      </div>

      {/* Log console */}
      <div className="bg-neutral-800 rounded-lg p-3">
        <div className="text-xs opacity-80 pb-2">Log</div>
        <div className="h-32 overflow-auto rounded border border-neutral-700 bg-neutral-900 text-xs p-2 font-mono leading-5">
          {logs.length === 0 ? (
            <div className="opacity-60">No events yet.</div>
          ) : (
            logs.map((line, i) => <div key={i}>{line}</div>)
          )}
        </div>
      </div>

      {/* GPU table */}
      <div className="bg-neutral-800 rounded-lg p-3">
        <div className="text-xs opacity-80 pb-2">GPUs</div>
        <table className="w-full text-xs">
          <thead className="text-left opacity-70">
            <tr>
              <th className="py-1">GPU</th>
              <th className="py-1">Hashrate</th>
              <th className="py-1">Temp</th>
              <th className="py-1">Fan</th>
            </tr>
          </thead>
          <tbody>
            {[1,2,3,4].map((id) => (
              <tr key={id} className="border-t border-neutral-700">
                <td className="py-1">GPU {id}</td>
                <td className="py-1">{(hashRate/4).toFixed(2)} H/s</td>
                <td className="py-1">{['63°C','66°C','64°C','65°C'][id-1]}</td>
                <td className="py-1">{['58%','61%','55%','59%'][id-1]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Rig actions (wire these if your contract exposes them) */}
        <div className="flex space-x-2 pt-2">
          <button className="flex-1 bg-neutral-700 hover:bg-neutral-600 text-xs py-1 rounded-md">Restart</button>
          <button className="flex-1 bg-neutral-700 hover:bg-neutral-600 text-xs py-1 rounded-md">Repair</button>
          <button className="flex-1 bg-neutral-700 hover:bg-neutral-600 text-xs py-1 rounded-md">Boost</button>
        </div>
      </div>
    </div>
  );
}

