"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import {
  baseTcAddress, baseTcABI,
  rigNftAddress, rigNftABI,
  gameCoreAddress, gameCoreABI,
} from '../lib/web3Config';

/**
 * Monitoring component displays real‑time mining status, including current
 * hashrate, yield, uptime, temperatures, power usage and a log of events.
 * Users can start and stop mining; when running a log entry is appended
 * periodically. GPU statistics are presented in a simple table and a set
 * of actions allow basic rig management. This component is intentionally
 * self‑contained and does not integrate with actual mining hardware –
 * instead it simulates values for demonstration purposes.
 */
export default function Monitoring() {
  const [mining, setMining] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  // Simulated metrics for demonstration. In a real implementation these
  // would come from on‑chain data or backend services.
  const [hashRate, setHashRate] = useState(1.23);
  const [uptime, setUptime] = useState(0);
  // The on-chain pending reward (24h yield equivalent) will be read via wagmi below

  // Update uptime every second when mining is active
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (mining) {
      interval = setInterval(() => {
        setUptime((prev) => prev + 1);
        // fluctuate hashRate slightly
        setHashRate((prev) => {
          const delta = (Math.random() - 0.5) * 0.05;
          return Math.max(0, Number((prev + delta).toFixed(2)));
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [mining]);

  // Append a simulated log message every 5 seconds when mining
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (mining) {
      interval = setInterval(() => {
        const messages = [
          '[INFO] Submitting share…',
          '[WARN] Fan speed high…',
          '[OK] Share accepted.',
          '[ERR] GPU throttle detected',
        ];
        const msg = messages[Math.floor(Math.random() * messages.length)];
        setLogs((prev) => [...prev.slice(-9), msg]);
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [mining]);

  const handleToggleMining = () => {
    setMining((running) => {
      const newStatus = !running;
      const message = newStatus ? '[OK] Miner started' : '[WARN] Miner stopped';
      setLogs((prev) => [...prev.slice(-9), message]);
      if (!newStatus) setHashRate(0);
      return newStatus;
    });
  };

  // GPU data – in the future this could be dynamic based on NFT rig stats
  const gpus = [
    { id: 1, hashrate: '62 MH/s', temp: '63°C', fan: '45%' },
    { id: 2, hashrate: '61 MH/s', temp: '65°C', fan: '47%' },
    { id: 3, hashrate: '60 MH/s', temp: '68°C', fan: '55%' },
  ];

  // ----- On-chain integrations -----
  // Account from wagmi (through Farcaster connector)
  const { address } = useAccount();

  // Read pending reward (if available on the GameCore contract)
  const { data: pending } = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: 'pendingReward',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  // Read BaseTC token balance
  const { data: baseBal } = useReadContract({
    address: baseTcAddress as `0x${string}`,
    abi: baseTcABI as any,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  // Read ERC1155 rig balances (IDs: 1=Basic, 2=Pro, 3=Legend)
  const { data: basicBal } = useReadContract({
    address: rigNftAddress as `0x${string}`,
    abi: rigNftABI as any,
    functionName: 'balanceOf',
    args: address ? [address, BigInt(1)] : undefined;
    query: { enabled: Boolean(address) },
  });
  const { data: proBal } = useReadContract({
    address: rigNftAddress as `0x${string}`,
    abi: rigNftABI as any,
    functionName: 'balanceOf',
   args: address ? [address, BigInt(2)] : undefined;
    query: { enabled: Boolean(address) },
  });
  const { data: legendBal } = useReadContract({
    address: rigNftAddress as `0x${string}`,
    abi: rigNftABI as any,
    functionName: 'balanceOf',
    args: address ? [address, BigInt(3)] : undefined;
    query: { enabled: Boolean(address) },
  });

  // Convert large integer values to human readable decimals
  const pendingReadable = useMemo(() => (pending ? Number(pending as any) / 1e18 : 0), [pending]);
  const tokenReadable = useMemo(() => (baseBal ? Number(baseBal as any) / 1e18 : 0), [baseBal]);

  // Optional: set up write hooks for rig actions (not wired in current UI)
  const { writeContract, data: ctrlTx, isPending: ctrlPending, error: ctrlError } = useWriteContract();
  const { isLoading: ctrlWaiting, isSuccess: ctrlOk } = useWaitForTransactionReceipt({ hash: ctrlTx });

  useEffect(() => {
    if (ctrlError) {
      const err: any = ctrlError;
      setLogs((l) => [...l.slice(-9), `[ERR] ${err?.shortMessage || err?.message || 'tx failed'}`]);
    }
    if (ctrlOk) setLogs((l) => [...l.slice(-9), `[OK] Rig action executed`]);
  }, [ctrlError, ctrlOk]);

  return (
    <div className="space-y-4 px-4 pt-4 pb-8">
      {/* Header and summary */}
      <header className="space-y-2">
        <h1 className="text-xl font-semibold">BaseTC Mining Console</h1>
        <p className="text-sm text-neutral-400">Farcaster Mini App</p>
      </header>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs md:text-sm">
        <div className="bg-neutral-800 rounded-lg p-2">
          <div className="text-neutral-400">Active Miners</div>
          <div className="text-lg font-semibold">{mining ? 12 : 0}</div>
        </div>
        <div className="bg-neutral-800 rounded-lg p-2">
          <div className="text-neutral-400">24h Yield</div>
          <div className="text-lg font-semibold">{pendingReadable.toFixed(3)} $BaseTC</div>
        </div>
        <div className="bg-neutral-800 rounded-lg p-2">
          <div className="text-neutral-400">Uptime</div>
          <div className="text-lg font-semibold">{Math.floor(uptime / 3600)}h {Math.floor((uptime % 3600) / 60)}m</div>
        </div>
      </div>

      {/* Token & rigs overview */}
      <div className="grid grid-cols-4 gap-2 text-center text-xs md:text-sm">
        <div className="bg-neutral-800 rounded-lg p-2">
          <div className="text-neutral-400">$BaseTC</div>
          <div className="text-lg font-semibold">{tokenReadable.toFixed(3)}</div>
        </div>
        <div className="bg-neutral-800 rounded-lg p-2">
          <div className="text-neutral-400">Basic</div>
          <div className="text-lg font-semibold">{String(basicBal ?? 0)}</div>
        </div>
        <div className="bg-neutral-800 rounded-lg p-2">
          <div className="text-neutral-400">Pro</div>
          <div className="text-lg font-semibold">{String(proBal ?? 0)}</div>
        </div>
        <div className="bg-neutral-800 rounded-lg p-2">
          <div className="text-neutral-400">Legend</div>
          <div className="text-lg font-semibold">{String(legendBal ?? 0)}</div>
        </div>
      </div>

      {/* Hashrate and controls */}
      <div className="flex items-center justify-between bg-neutral-800 rounded-lg p-3">
        <div className="flex items-baseline space-x-1">
          <span className="text-neutral-400 text-xs">Hashrate:</span>
          <span className="text-xl font-semibold">{hashRate.toFixed(2)} GH/s</span>
        </div>
        <button
          onClick={handleToggleMining}
          className="px-3 py-1.5 rounded-md text-sm font-medium text-white transition-colors"
          style={{ backgroundColor: mining ? '#dc2626' : '#16a34a' }}
        >
          {mining ? 'Stop' : 'Start'}
        </button>
      </div>

      {/* Temperature & power */}
      <div className="grid grid-cols-2 gap-2 text-center text-xs md:text-sm">
        <div className="bg-neutral-800 rounded-lg p-2">
          <div className="text-neutral-400">Temp Avg</div>
          <div className="text-lg font-semibold">64°C</div>
        </div>
        <div className="bg-neutral-800 rounded-lg p-2">
          <div className="text-neutral-400">Power</div>
          <div className="text-lg font-semibold">1.2 kW</div>
        </div>
      </div>

      {/* Log console */}
      <div className="bg-neutral-800 rounded-lg p-2 h-32 overflow-y-auto font-mono text-xs whitespace-pre-wrap">
        {logs.length === 0 ? (
          <div className="text-neutral-500">No events yet…</div>
        ) : (
          logs.map((line, idx) => <div key={idx}>{line}</div>)
        )}
      </div>

      {/* Rig panel */}
      <div className="bg-neutral-800 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Rig Pro #A17</h2>
            <p className="text-xs text-neutral-400">Legendary uptime</p>
          </div>
          {/* Placeholder image for rig */}
          <div className="w-16 h-12 bg-neutral-700 rounded-md flex items-center justify-center text-xs text-neutral-400">
            Img
          </div>
        </div>
        {/* GPU table */}
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="text-neutral-400">
              <th className="py-1">GPU</th>
              <th className="py-1">Hashrate</th>
              <th className="py-1">Temp</th>
              <th className="py-1">Fan</th>
            </tr>
          </thead>
          <tbody>
            {gpus.map((gpu) => (
              <tr key={gpu.id} className="border-t border-neutral-700">
                <td className="py-1">GPU {gpu.id}</td>
                <td className="py-1">{gpu.hashrate}</td>
                <td className="py-1">{gpu.temp}</td>
                <td className="py-1">{gpu.fan}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Rig actions */}
        <div className="flex space-x-2 pt-2">
          <button className="flex-1 bg-neutral-700 hover:bg-neutral-600 text-xs py-1 rounded-md">Restart</button>
          <button className="flex-1 bg-neutral-700 hover:bg-neutral-600 text-xs py-1 rounded-md">Repair</button>
          <button className="flex-1 bg-neutral-700 hover:bg-neutral-600 text-xs py-1 rounded-md">Boost</button>
        </div>
      </div>
    </div>
  );
}
