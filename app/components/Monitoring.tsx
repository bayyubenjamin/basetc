"use client";

import { useState, useEffect, useMemo } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import {
  baseTcAddress,
  baseTcABI,
  rigNftAddress,
  rigNftABI,
  gameCoreAddress,
  gameCoreABI,
} from "../lib/web3Config";

/**
 * Monitoring: menampilkan status mining on-chain (+ simulasi UI miner).
 * - Baca: BASIC/PRO/LEGEND ID dari RigNFT
 * - Baca: saldo NFT per tier, saldo $BaseTC
 * - Baca: epochNow, preview(epochNow-1, user), getHashrate, getBaseUnit, isSupreme
 * - Simulasi kontrol start/stop + log
 */
export default function Monitoring() {
  // ---------- UI simulasi miner ----------
  const [mining, setMining] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [hashRateSim, setHashRateSim] = useState(1.23);
  const [uptime, setUptime] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (mining) {
      interval = setInterval(() => {
        setUptime((prev) => prev + 1);
        setHashRateSim((prev) => {
          const delta = (Math.random() - 0.5) * 0.05;
          return Math.max(0, Number((prev + delta).toFixed(2)));
        });
      }, 1000);
    }
    return () => interval && clearInterval(interval);
  }, [mining]);

  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (mining) {
      interval = setInterval(() => {
        const messages = [
          "[INFO] Submitting share…",
          "[WARN] Fan speed high…",
          "[OK] Share accepted.",
          "[ERR] GPU throttle detected",
        ];
        const msg = messages[Math.floor(Math.random() * messages.length)];
        setLogs((prev) => [...prev.slice(-99), msg]);
      }, 5000);
    }
    return () => interval && clearInterval(interval);
  }, [mining]);

  const handleToggleMining = () => {
    setMining((running) => {
      const next = !running;
      const message = next ? "[OK] Miner started" : "[WARN] Miner stopped";
      setLogs((prev) => [...prev.slice(-99), message]);
      if (!next) setHashRateSim(0);
      return next;
    });
  };

  // ---------- On-chain ----------
  const { address } = useAccount();

  // 1) Ambil ID tier dari kontrak (lebih aman daripada hardcode 1/2/3)
  const basicId = useReadContract({
    address: rigNftAddress as `0x${string}`,
    abi: rigNftABI as any,
    functionName: "BASIC",
  });
  const proId = useReadContract({
    address: rigNftAddress as `0x${string}`,
    abi: rigNftABI as any,
    functionName: "PRO",
  });
  const legendId = useReadContract({
    address: rigNftAddress as `0x${string}`,
    abi: rigNftABI as any,
    functionName: "LEGEND",
  });

  const BASIC = basicId.data as bigint | undefined;
  const PRO = proId.data as bigint | undefined;
  const LEGEND = legendId.data as bigint | undefined;

  // 2) Saldo NFT per tier (enabled hanya jika address & id tersedia)
  const basicBal = useReadContract({
    address: rigNftAddress as `0x${string}`,
    abi: rigNftABI as any,
    functionName: "balanceOf",
    args: address && BASIC !== undefined ? [address, BASIC] : undefined,
    query: { enabled: Boolean(address && BASIC !== undefined) },
  });
  const proBal = useReadContract({
    address: rigNftAddress as `0x${string}`,
    abi: rigNftABI as any,
    functionName: "balanceOf",
    args: address && PRO !== undefined ? [address, PRO] : undefined,
    query: { enabled: Boolean(address && PRO !== undefined) },
  });
  const legendBal = useReadContract({
    address: rigNftAddress as `0x${string}`,
    abi: rigNftABI as any,
    functionName: "balanceOf",
    args: address && LEGEND !== undefined ? [address, LEGEND] : undefined,
    query: { enabled: Boolean(address && LEGEND !== undefined) },
  });

  // 3) Saldo token $BaseTC
  const baseBal = useReadContract({
    address: baseTcAddress as `0x${string}`,
    abi: baseTcABI as any,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  // 4) Info mining dari GameCore
  const epochNow = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "epochNow",
  });

  // Preview reward epoch sebelumnya (epochNow-1), hanya jika > 0
  const preview = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "preview",
    args:
      address &&
      typeof epochNow.data !== "undefined" &&
      (epochNow.data as bigint) > 0n
        ? [(epochNow.data as bigint) - 1n, address]
        : undefined,
    query: {
      enabled:
        Boolean(address) &&
        typeof epochNow.data !== "undefined" &&
        (epochNow.data as bigint) > 0n,
    },
  });

  const hashrateOnchain = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "getHashrate",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const baseUnit = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "getBaseUnit",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const isSupreme = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "isSupreme",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  // ---------- Helpers angka ----------
  const tokenReadable = useMemo(() => {
    const v = baseBal.data as bigint | undefined;
    return v ? Number(v) / 1e18 : 0;
  }, [baseBal.data]);

  const previewReadable = useMemo(() => {
    const v = preview.data as bigint | undefined;
    return v ? Number(v) / 1e18 : 0;
  }, [preview.data]);

  const hashrateReadable = useMemo(() => {
    const v = hashrateOnchain.data as bigint | undefined;
    // asumsi satuan hashrate sudah “unit” sesuai kontrak; tampilkan apa adanya
    return v ? Number(v) : 0;
  }, [hashrateOnchain.data]);

  const baseUnitReadable = useMemo(() => {
    const v = baseUnit.data as bigint | undefined;
    return v ? Number(v) : 0;
  }, [baseUnit.data]);

  // ---------- Optional: hook write (untuk aksi rig di masa depan) ----------
  const { writeContract, data: ctrlTx, isPending: ctrlPending, error: ctrlError } =
    useWriteContract();
  const { isLoading: ctrlWaiting, isSuccess: ctrlOk } = useWaitForTransactionReceipt({
    hash: ctrlTx,
  });

  useEffect(() => {
    if (ctrlError) {
      const err: any = ctrlError;
      setLogs((l) => [
        ...l.slice(-99),
        `[ERR] ${err?.shortMessage || err?.message || "tx failed"}`,
      ]);
    }
    if (ctrlOk) {
      setLogs((l) => [...l.slice(-99), `[OK] Rig action executed`]);
    }
  }, [ctrlError, ctrlOk]);

  // ---------- Data dummy GPU ----------
  const gpus = [
    { id: 1, hashrate: "62 MH/s", temp: "63°C", fan: "45%" },
    { id: 2, hashrate: "61 MH/s", temp: "65°C", fan: "47%" },
    { id: 3, hashrate: "60 MH/s", temp: "68°C", fan: "55%" },
  ];

  return (
    <div className="space-y-4 px-4 pt-4 pb-8">
      {/* Header */}
      <header className="space-y-2">
        <h1 className="text-xl font-semibold">BaseTC Mining Console</h1>
        <p className="text-sm text-neutral-400">Farcaster Mini App</p>
      </header>

      {/* Ringkasan top */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs md:text-sm">
        <div className="bg-neutral-800 rounded-lg p-2">
          <div className="text-neutral-400">Epoch</div>
          <div className="text-lg font-semibold">
            {typeof epochNow.data !== "undefined" ? String(epochNow.data) : "-"}
          </div>
        </div>
        <div className="bg-neutral-800 rounded-lg p-2">
          <div className="text-neutral-400">Preview (epoch-1)</div>
          <div className="text-lg font-semibold">
            {previewReadable.toFixed(3)} $BaseTC
          </div>
        </div>
        <div className="bg-neutral-800 rounded-lg p-2">
          <div className="text-neutral-400">Uptime</div>
          <div className="text-lg font-semibold">
            {Math.floor(uptime / 3600)}h {Math.floor((uptime % 3600) / 60)}m
          </div>
        </div>
      </div>

      {/* Token & NFT overview */}
      <div className="grid grid-cols-4 gap-2 text-center text-xs md:text-sm">
        <div className="bg-neutral-800 rounded-lg p-2">
          <div className="text-neutral-400">$BaseTC</div>
          <div className="text-lg font-semibold">{tokenReadable.toFixed(3)}</div>
        </div>
        <div className="bg-neutral-800 rounded-lg p-2">
          <div className="text-neutral-400">Basic</div>
          <div className="text-lg font-semibold">
            {String((basicBal.data as bigint | undefined) ?? 0n)}
          </div>
        </div>
        <div className="bg-neutral-800 rounded-lg p-2">
          <div className="text-neutral-400">Pro</div>
          <div className="text-lg font-semibold">
            {String((proBal.data as bigint | undefined) ?? 0n)}
          </div>
        </div>
        <div className="bg-neutral-800 rounded-lg p-2">
          <div className="text-neutral-400">Legend</div>
          <div className="text-lg font-semibold">
            {String((legendBal.data as bigint | undefined) ?? 0n)}
          </div>
        </div>
      </div>

      {/* On-chain miner stats */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs md:text-sm">
        <div className="bg-neutral-800 rounded-lg p-2">
          <div className="text-neutral-400">Hashrate (on-chain)</div>
          <div className="text-lg font-semibold">{hashrateReadable}</div>
        </div>
        <div className="bg-neutral-800 rounded-lg p-2">
          <div className="text-neutral-400">Base Unit</div>
          <div className="text-lg font-semibold">{baseUnitReadable}</div>
        </div>
        <div className="bg-neutral-800 rounded-lg p-2">
          <div className="text-neutral-400">Supreme</div>
          <div className="text-lg font-semibold">
            {String((isSupreme.data as boolean | undefined) ?? false)}
          </div>
        </div>
      </div>

      {/* Hashrate simulasi + kontrol */}
      <div className="flex items-center justify-between bg-neutral-800 rounded-lg p-3">
        <div className="flex items-baseline space-x-1">
          <span className="text-neutral-400 text-xs">Hashrate (sim):</span>
          <span className="text-xl font-semibold">{hashRateSim.toFixed(2)} GH/s</span>
        </div>
        <button
          onClick={handleToggleMining}
          className="px-3 py-1.5 rounded-md text-sm font-medium text-white transition-colors"
          style={{ backgroundColor: mining ? "#dc2626" : "#16a34a" }}
        >
          {mining ? "Stop" : "Start"}
        </button>
      </div>

      {/* Suhu & daya (dummy) */}
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

      {/* Log */}
      <div className="bg-neutral-800 rounded-lg p-2 h-32 overflow-y-auto font-mono text-xs whitespace-pre-wrap">
        {logs.length === 0 ? (
          <div className="text-neutral-500">No events yet…</div>
        ) : (
          logs.map((line, idx) => <div key={idx}>{line}</div>)
        )}
      </div>

      {/* Panel rig (dummy UI) */}
      <div className="bg-neutral-800 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Rig Pro #A17</h2>
            <p className="text-xs text-neutral-400">Legendary uptime</p>
          </div>
          <div className="w-16 h-12 bg-neutral-700 rounded-md flex items-center justify-center text-xs text-neutral-400">
            Img
          </div>
        </div>
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
            {[{ id: 1, hashrate: "62 MH/s", temp: "63°C", fan: "45%" },
              { id: 2, hashrate: "61 MH/s", temp: "65°C", fan: "47%" },
              { id: 3, hashrate: "60 MH/s", temp: "68°C", fan: "55%" }].map((gpu) => (
              <tr key={gpu.id} className="border-t border-neutral-700">
                <td className="py-1">GPU {gpu.id}</td>
                <td className="py-1">{gpu.hashrate}</td>
                <td className="py-1">{gpu.temp}</td>
                <td className="py-1">{gpu.fan}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex space-x-2 pt-2">
          <button className="flex-1 bg-neutral-700 hover:bg-neutral-600 text-xs py-1 rounded-md">Restart</button>
          <button className="flex-1 bg-neutral-700 hover:bg-neutral-600 text-xs py-1 rounded-md">Repair</button>
          <button className="flex-1 bg-neutral-700 hover:bg-neutral-600 text-xs py-1 rounded-md">Boost</button>
        </div>
      </div>
    </div>
  );
}

