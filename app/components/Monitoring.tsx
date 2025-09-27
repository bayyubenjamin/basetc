"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { baseSepolia } from "viem/chains";
import {
  baseTcAddress,
  baseTcABI,
  rigNftAddress,
  rigNftABI,
  gameCoreAddress,
  gameCoreABI,
  chainId as BASE_CHAIN_ID,
} from "../lib/web3Config";

// Fungsi untuk meringkas angka besar
const formatNumber = (num: number) => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
};

export default function Monitoring() {
  const { address } = useAccount();

  // State UI
  const [msg, setMsg] = useState<string>("");
  const [now, setNow] = useState<number>(Math.floor(Date.now() / 1000));
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);

  // Realtime tick per 1s
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  
  // Fungsi untuk menambahkan log ke terminal
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setTerminalLogs(prev => [`[${timestamp}] ${message}`, ...prev].slice(0, 10)); // Batasi 10 log
  };

  // Ambil ID tier dari RigNFT
  const basicId = useReadContract({ address: rigNftAddress as `0x${string}`, abi: rigNftABI as any, functionName: "BASIC" });
  const proId = useReadContract({ address: rigNftAddress as `0x${string}`, abi: rigNftABI as any, functionName: "PRO" });
  const legendId = useReadContract({ address: rigNftAddress as `0x${string}`, abi: rigNftABI as any, functionName: "LEGEND" });

  const BASIC = basicId.data as bigint | undefined;
  const PRO = proId.data as bigint | undefined;
  const LEGEND = legendId.data as bigint | undefined;

  // Saldo NFT per tier
  const basicBal = useReadContract({ address: rigNftAddress as `0x${string}`, abi: rigNftABI as any, functionName: "balanceOf", args: address && BASIC !== undefined ? [address, BASIC] : undefined, query: { enabled: Boolean(address && BASIC !== undefined) } });
  const proBal = useReadContract({ address: rigNftAddress as `0x${string}`, abi: rigNftABI as any, functionName: "balanceOf", args: address && PRO !== undefined ? [address, PRO] : undefined, query: { enabled: Boolean(address && PRO !== undefined) } });
  const legendBal = useReadContract({ address: rigNftAddress as `0x${string}`, abi: rigNftABI as any, functionName: "balanceOf", args: address && LEGEND !== undefined ? [address, LEGEND] : undefined, query: { enabled: Boolean(address && LEGEND !== undefined) } });

  const countBasic = (basicBal.data as bigint | undefined) ?? 0n;
  const countPro = (proBal.data as bigint | undefined) ?? 0n;
  const countLegend = (legendBal.data as bigint | undefined) ?? 0n;

  // Saldo $BaseTC
  const baseBal = useReadContract({ address: baseTcAddress as `0x${string}`, abi: baseTcABI as any, functionName: "balanceOf", args: address ? [address] : undefined, query: { enabled: Boolean(address) } });
  const tokenReadable = useMemo(() => {
    const v = baseBal.data as bigint | undefined;
    return v ? Number(v) / 1e18 : 0;
  }, [baseBal.data]);

  // GameCore reads
  const epochNow = useReadContract({ address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: "epochNow" });
  const epochLength = useReadContract({ address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: "epochLength" });
  const startTime = useReadContract({ address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: "startTime" });
  const isPrelaunch = useReadContract({ address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: "isPrelaunch" });
  const goLive = useReadContract({ address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: "goLive" });
  const miningActive = useReadContract({ address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: "miningActive", args: address ? [address] : undefined, query: { enabled: Boolean(address) } });
  const lastToggleEpoch = useReadContract({ address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: "lastToggleEpoch", args: address ? [address] : undefined, query: { enabled: Boolean(address) } });
  const toggleCooldown = useReadContract({ address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: "toggleCooldown" });
  const hashrate = useReadContract({ address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: "getHashrate", args: address ? [address] : undefined, query: { enabled: Boolean(address) } });
  const baseUnit = useReadContract({ address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: "getBaseUnit", args: address ? [address] : undefined, query: { enabled: Boolean(address) } });
  const isSupreme = useReadContract({ address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: "isSupreme", args: address ? [address] : undefined, query: { enabled: Boolean(address) } });

  // Normalisasi nilai
  const hrNum = useMemo(() => { const v = hashrate.data as bigint | undefined; return v ? Number(v) : 0; }, [hashrate.data]);
  const baseUnitNum = useMemo(() => { const v = baseUnit.data as bigint | undefined; return v ? Number(v) : 0; }, [baseUnit.data]);
  const active = Boolean((miningActive.data as boolean | undefined) ?? false);
  const eNow = (epochNow.data as bigint | undefined) ?? undefined;
  const eLen = (epochLength.data as bigint | undefined) ?? undefined;
  const sTime = (startTime.data as bigint | undefined) ?? undefined;
  const lastE = (lastToggleEpoch.data as bigint | undefined) ?? 0n;
  const cd = (toggleCooldown.data as bigint | undefined) ?? 0n;
  const prelaunch = Boolean((isPrelaunch.data as boolean | undefined) ?? false);
  const goLiveOn = Boolean((goLive.data as boolean | undefined) ?? false);

  // Epoch progress & ETA
  const targetEpoch1 = useMemo(() => { if (!sTime || !eLen) return undefined; return Number(sTime + eLen); }, [sTime, eLen]);
  const epochProgress = useMemo(() => {
    if (!sTime || !eLen) return { pct: 0, leftSec: 0 };
    const sinceStart = BigInt(now) - sTime;
    if (sinceStart < 0n) return { pct: 0, leftSec: Number(eLen) };
    const pos = sinceStart % eLen;
    const left = eLen - pos;
    const pct = Number((pos * 100n) / eLen);
    return { pct, leftSec: Number(left) };
  }, [now, sTime, eLen]);
  const leftMMSS = useMemo(() => {
    const s = epochProgress.leftSec;
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m ${r.toString().padStart(2, "0")}s`;
    return `${m}:${r.toString().padStart(2, "0")}`;
  }, [epochProgress.leftSec]);

  // Cooldown logic
  const canToggle = useMemo(() => {
    if (eNow === undefined) return false;
    if (prelaunch && goLiveOn) return false;
    return eNow >= lastE + cd;
  }, [eNow, lastE, cd, prelaunch, goLiveOn]);
  const nextToggleEpoch = useMemo(() => { if (lastE === undefined) return undefined; return lastE + cd; }, [lastE, cd]);

  // Start / Stop (tx)
  const { writeContract, data: txHash, isPending, error } = useWriteContract();
  const { isLoading: waitingReceipt, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (isSuccess) {
      setMsg("Transaksi berhasil.");
      addLog(`Success: Transaction confirmed.`);
    }
    if (error) {
      const e: any = error;
      const shortMsg = e?.shortMessage || e?.message || "Transaction failed";
      setMsg(shortMsg);
      addLog(`Error: ${shortMsg}`);
    }
  }, [isSuccess, error]);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 2800);
    return () => clearTimeout(t);
  }, [msg]);

  const onStart = () => {
    if (!address) { setMsg("Connect wallet dulu."); return; }
    if (prelaunch && goLiveOn) { setMsg("Prelaunch aktif. Tunggu epoch 1."); return; }
    if (!canToggle) { setMsg("Masih cooldown. Coba lagi nanti."); return; }
    setMsg("");
    addLog("Sending start mining transaction...");
    writeContract({ address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: "startMining", args: [], account: address as `0x${string}`, chain: baseSepolia, chainId: BASE_CHAIN_ID });
  };

  const onStop = () => {
    if (!address) { setMsg("Connect wallet dulu."); return; }
    if (prelaunch && goLiveOn) { setMsg("Prelaunch aktif. Tunggu epoch 1."); return; }
    if (!canToggle) { setMsg("Masih cooldown. Coba lagi nanti."); return; }
    setMsg("");
    addLog("Sending stop mining transaction...");
    writeContract({ address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: "stopMining", args: [], account: address as `0x${string}`, chain: baseSepolia, chainId: BASE_CHAIN_ID });
  };

  const busy = isPending || waitingReceipt;

  return (
    <div className="space-y-4 px-4 pt-4 pb-24">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Mining Console</h1>
        <p className="text-sm text-neutral-400">Real-time on-chain monitoring</p>
      </header>
      
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 space-y-3 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-400">Epoch</span>
            <span className="text-lg font-semibold">{typeof eNow !== "undefined" ? String(eNow) : "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded-md text-xs font-medium border ${prelaunch && goLiveOn ? "bg-yellow-500/10 text-yellow-300 border-yellow-500/30" : active ? "bg-green-500/10 text-green-400 border-green-500/30" : "bg-neutral-800 text-neutral-300 border-neutral-700"}`}>
              {prelaunch && goLiveOn ? "Prelaunch" : active ? "Active" : "Paused"}
            </span>
          </div>
        </div>
        
        <div>
          <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
            <span>Epoch progress</span>
            <span>Next in {leftMMSS}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-neutral-800 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500 transition-all" style={{ width: `${epochProgress.pct}%` }}/>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-neutral-400">Cooldown: <span className="text-neutral-200">{String(cd ?? 0n)} epoch</span></div>
          {active ? (
            <button onClick={onStop} disabled={!address || busy || !canToggle || (prelaunch && goLiveOn)} className={`px-4 py-2 rounded-lg text-sm font-medium text-white shadow ${!address || busy || !canToggle || (prelaunch && goLiveOn) ? "bg-neutral-700 text-neutral-400" : "bg-red-600 hover:bg-red-500"}`}>{busy ? "Stopping…" : "Stop Mining"}</button>
          ) : (
            <button onClick={onStart} disabled={!address || busy || !canToggle || (prelaunch && goLiveOn)} className={`px-4 py-2 rounded-lg text-sm font-medium text-white shadow ${!address || busy || !canToggle || (prelaunch && goLiveOn) ? "bg-neutral-700 text-neutral-400" : "bg-emerald-600 hover:bg-emerald-500"}`}>{busy ? "Starting…" : "Start Mining"}</button>
          )}
        </div>
        {!!msg && <div className="text-xs text-emerald-400 pt-1">{msg}</div>}
      </div>

      <div className="bg-black/50 border border-neutral-800 rounded-lg p-3 font-mono text-xs text-green-400 space-y-1 h-32 overflow-y-auto">
        <p>&gt; Terminal ready...</p>
        {terminalLogs.map((log, i) => <p key={i}>&gt; {log}</p>)}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatCard title="Hashrate" value={formatNumber(hrNum)} />
        <StatCard title="Base Unit" value={formatNumber(baseUnitNum)} />
        <StatCard title="$BaseTC" value={tokenReadable.toFixed(3)} />
      </div>

      <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold">Your Rigs</h2>
        <div className="grid grid-cols-3 gap-3">
          <RigCard tier="Basic" count={String(countBasic)} image="/img/basic.png" owned={countBasic > 0n} />
          <RigCard tier="Pro" count={String(countPro)} image="/img/pro.png" owned={countPro > 0n} />
          <RigCard tier="Legend" count={String(countLegend)} image="/img/legend.png" owned={countLegend > 0n} />
        </div>
      </div>
    </div>
  );
}

// --- Komponen-komponen Kecil ---

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 text-center shadow">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-neutral-400">{title}</div>
    </div>
  );
}

function RigCard({ tier, count, image, owned }: { tier: string, count: string, image: string, owned: boolean }) {
  return (
    <div className="bg-neutral-800 rounded-lg p-3 text-center space-y-2">
      <div className={`relative aspect-square transition-all duration-300 ${!owned ? 'filter blur-sm opacity-50' : ''}`}>
        <Image src={image} alt={`${tier} Rig`} layout="fill" objectFit="contain" />
      </div>
      <div>
        <div className="text-sm text-neutral-400">{tier}</div>
        <div className="text-lg font-semibold">x{count}</div>
      </div>
    </div>
  );
}
