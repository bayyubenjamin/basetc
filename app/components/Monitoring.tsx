"use client";
import { useEffect, useRef, useState, FC, ReactNode } from "react";
import { Nft } from "../page";
import { useWeb3 } from "../context/Web3Provider"; // <-- Impor hook useWeb3

// --- Custom Hook untuk Transisi Angka yang Halus ---
const useSmoothNumber = (targetValue: number, duration: number = 3000) => {
    const [currentValue, setCurrentValue] = useState(targetValue);
    const frameRef = useRef<number>();
    useEffect(() => {
        const startTime = Date.now();
        const startValue = currentValue;
        const animate = () => {
            const elapsedTime = Date.now() - startTime;
            const progress = Math.min(elapsedTime / duration, 1);
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            const nextValue = startValue + (targetValue - startValue) * easedProgress;
            setCurrentValue(nextValue);
            if (progress < 1) {
                frameRef.current = requestAnimationFrame(animate);
            }
        };
        cancelAnimationFrame(frameRef.current!);
        frameRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(frameRef.current!);
    }, [targetValue]);
    return currentValue;
};

// --- Types & Helper Components (Tetap Sama) ---
type NftTier = "Basic" | "Pro" | "Legend";
type LogLine = { time: string; message: string; type: 'info' | 'ok' | 'warn' | 'error'; };
const Icon = ({ path, className = "w-4 h-4" }: { path: string; className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d={path} /></svg>
);
const DataTile = ({ title, value, color = "text-white" }: { title: string; value: string | ReactNode; color?: string }) => (
    <div className="rounded-md border border-[#122b3c] bg-gradient-to-b from-[#08141b] to-[#061018] p-2 h-full flex flex-col justify-center"><div className="text-xs font-semibold text-[#9aacc6]">{title}</div><div className={`text-sm font-bold ${color}`}>{value}</div></div>
);
const Terminal: FC<{ lines: LogLine[] }> = ({ lines }) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    useEffect(() => { if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight; }, [lines]);
    const typeToColorClass: Record<LogLine['type'], string> = { info: 'term-info', ok: 'term-ok', warn: 'term-warn', error: 'term-err' };
    return (
        <div ref={terminalRef} className="terminal">{lines.map((line, index) => (<div key={index} className={`term-line ${typeToColorClass[line.type]}`}><span className="opacity-50 mr-2">{line.time}</span><span>{line.message}</span></div>))}</div>
    );
};

// --- Tipe Props Baru ---
interface MonitoringProps {
  inventory: Nft[];
  mining: boolean;
  setMining: (mining: boolean | ((m: boolean) => boolean)) => void;
  unclaimedRewards: number;
  lastClaimTimestamp: number;
  handleClaim: () => Promise<void>; // Diubah menjadi promise
}

// --- Komponen Utama Monitoring ---
export default function Monitoring({ inventory, mining, setMining, unclaimedRewards, lastClaimTimestamp, handleClaim }: MonitoringProps) {
  const { gameCoreContract } = useWeb3(); // Ambil kontrak dari context
  const [isClaiming, setIsClaiming] = useState(false);
  const [uptimeSec, setUptimeSec] = useState(0);
  const [targetState, setTargetState] = useState({
      ping: 0,
      totalHashrate: 0,
      totalPower: 0,
      gpuStats: inventory.map(nft => ({ id: nft.id, temp: 40, fan: 40, hash: 0 }))
  });
  const [logLines, setLogLines] = useState<LogLine[]>([]);

  const smoothHashrate = useSmoothNumber(targetState.totalHashrate);
  const smoothPower = useSmoothNumber(targetState.totalPower);
  const smoothPing = useSmoothNumber(targetState.ping);
  const uptimeStr = new Date(uptimeSec * 1000).toISOString().substr(11, 8);
  const hoursSinceLastClaim = lastClaimTimestamp > 0 ? (Date.now() - lastClaimTimestamp) / (1000 * 60 * 60) : 0;

  const addLog = (message: string, type: LogLine['type'] = 'info') => {
      const time = new Date().toLocaleTimeString('en-US', { hour12: false });
      setLogLines(prev => [...prev.slice(-50), { time, message, type }]);
  };

  useEffect(() => { addLog('Console connected to on-chain data.', 'ok') }, []);
  const getBaseHashrate = (tier: NftTier) => ({ Basic: 1.5, Pro: 5.0, Legend: 25.0 }[tier] || 0);

  useEffect(() => {
    const uptimeInterval = setInterval(() => { if (mining) setUptimeSec(prevSec => prevSec + 1) }, 1000);
    return () => clearInterval(uptimeInterval);
  }, [mining]);

  useEffect(() => {
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const dataInterval = setInterval(() => {
      const newGpuStats = inventory.map((nft, i) => {
        const baseTemp = 40 + Math.sin((Date.now() / 1000 + i * 5) / (12 + i)) * (2 + i);
        const fan = Math.max(18, Math.min(100, Math.round(38 + (baseTemp - 40) * 3 + rand(-3, 3))));
        const baseHash = getBaseHashrate(nft.tier);
        const hash = mining ? (baseHash + (fan / 100) * (baseHash * 0.1) + rand(-0.05, 0.05)) : 0;
        return { id: nft.id, temp: baseTemp + (mining ? 4 : 0), fan, hash };
      });
      setTargetState({
        ping: Math.round(rand(18, 120)),
        totalHashrate: newGpuStats.reduce((acc, gpu) => acc + gpu.hash, 0),
        totalPower: newGpuStats.reduce((acc, gpu) => acc + (150 + gpu.fan * 1.1 + gpu.hash * 40), 0),
        gpuStats: newGpuStats
      });
      if (mining && Math.random() < 0.2) addLog(`Share found and accepted.`, 'info');
    }, 3500);
    return () => clearInterval(dataInterval);
  }, [mining, inventory]);

  const onClaimClick = async () => {
      setIsClaiming(true);
      addLog('Sending claim transaction...', 'info');
      await handleClaim(); // Panggil fungsi dari page.tsx
      addLog('Claim transaction confirmed!', 'ok');
      setIsClaiming(false);
  };

  const handleToggleMining = () => {
    if (hoursSinceLastClaim > 48) {
        addLog("Cannot start mining. You must claim rewards first.", "error");
        return;
    }
    const nextState = !mining;
    setMining(nextState);
    addLog(nextState ? 'Mining process started.' : 'Mining process stopped.', 'info');
  };

  return (
    <div className="mx-auto max-w-[430px] px-3 pb-4 pt-3 flex-grow space-y-3">
        <header className="flex items-center justify-between gap-2">
            <div>
                <div className="font-bold leading-tight">My Mining Operation</div>
                <div className="text-xs text-[#9aacc6]">{inventory.length} Rigs Online</div>
            </div>
            <div className="flex items-center gap-1 rounded-full border border-[#233045] bg-gradient-to-b from-[#0f1622] to-[#0a1119] p-1 text-xs text-yellow-400">
                <span className="pl-2 font-semibold">Unclaimed:</span>
                <strong className="text-white font-bold">{unclaimedRewards.toFixed(4)}</strong>
                <button 
                    onClick={onClaimClick} 
                    disabled={isClaiming || unclaimedRewards <= 0}
                    className="rounded-full bg-[#0f2432] border border-[#30435e] px-3 py-1 text-xs font-semibold text-white hover:bg-[#1a384f] disabled:bg-gray-700 disabled:cursor-not-allowed"
                >
                    {isClaiming ? "Claiming..." : "Claim"}
                </button>
            </div>
        </header>

        <section className="rounded-xl border border-[#182737] bg-gradient-to-b from-[#0f1622] to-[#0b1118] p-3 shadow-lg space-y-3">
             {hoursSinceLastClaim > 24 && (
                <div className={`p-2 rounded-lg text-center text-xs font-semibold ${hoursSinceLastClaim > 48 ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'}`}>
                    {hoursSinceLastClaim > 48 ? 'MINING STOPPED! You must claim your rewards.' : 'Warning: Please claim your rewards soon!'}
                </div>
             )}
            <div className="flex justify-between items-center gap-2">
                <div className="text-xs flex items-center gap-2">
                    <div className="flex items-center gap-1.5 py-1 px-2 rounded-md bg-gray-900/50 border border-gray-700">
                        <div className={`w-2 h-2 rounded-full ${mining ? 'bg-green-400' : 'bg-gray-500'}`}></div>
                        <span>{mining ? 'Connected' : 'Idle'}</span>
                    </div>
                    <div className="py-1 px-2 rounded-md bg-gray-900/50 border border-gray-700">
                        <span>Ping: {smoothPing.toFixed(0)} ms</span>
                    </div>
                </div>
                 <button onClick={handleToggleMining} className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-all ${mining ? 'border-red-500/50 bg-red-500/10 text-red-400' : 'border-green-500/50 bg-green-500/10 text-green-400'}`}>
                    {mining ? "Stop" : "Start"}
                </button>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
                 <DataTile title="Total Hashrate" value={`${smoothHashrate.toFixed(2)} H/s`} />
                 <DataTile title="Power" value={`${smoothPower.toFixed(0)} W`} color="text-yellow-400" />
                 <DataTile title="Uptime" value={uptimeStr} />
            </div>
            <div className="overflow-hidden rounded-lg border border-[#223146] bg-[#06101a]"><img src="/img/pro.png" alt="Rig room" className="w-full" /></div>
            <Terminal lines={logLines} />
            <table className="w-full border-collapse text-sm">
                <thead><tr className="text-left text-xs font-semibold text-[#9aacc6]"><th className="p-2">Unit</th><th className="p-2 text-center">Temp.</th><th className="p-2 text-center">Fan Speed</th><th className="p-2 text-right">Hashrate</th></tr></thead>
                <tbody className="[&>tr>td]:border-t [&>tr>td]:border-white/5">
                    {inventory.map((nft, index) => {
                        const stats = targetState.gpuStats[index] || { temp: 0, fan: 0, hash: 0 };
                        const smoothGpuHash = useSmoothNumber(stats.hash); 
                        return (<tr key={nft.id}><td className="p-2 font-mono text-[#9aacc6]">GPU_{nft.id}</td><td className="p-2 text-center font-mono text-green-400">{stats.temp.toFixed(1)} °C</td><td className="p-2 text-center font-mono text-blue-400">{stats.fan.toFixed(0)}%</td><td className="p-2 text-right font-mono text-white">{smoothGpuHash.toFixed(2)} H/s</td></tr>);
                    })}
                </tbody>
            </table>
        </section>
    </div>
  );
}
