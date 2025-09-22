"use client";
import { useEffect, useRef, useState, FC, ReactNode } from "react";
import { Nft } from "../page";

// --- Custom Hook (No UI Change) ---
const useSmoothNumber = (targetValue: number, duration: number = 2000) => {
  const [currentValue, setCurrentValue] = useState(targetValue);
  const frameRef = useRef<number>();
  useEffect(() => {
    const startTime = Date.now();
    const startValue = currentValue;
    const animate = () => {
      const elapsedTime = Date.now() - startTime;
      const progress = Math.min(elapsedTime / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 4);
      const nextValue = startValue + (targetValue - startValue) * easedProgress;
      setCurrentValue(nextValue);
      if (progress < 1) frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current!);
  }, [targetValue, duration, currentValue]);
  return currentValue;
};


// --- Types & Helper Components ---
type LogLine = { time: string; message: string; type: 'info' | 'ok' | 'warn' | 'error'; };
const Icon: FC<{ path: string; className?: string }> = ({ path, className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d={path} /></svg>
);

const DataTile: FC<{ title: string; value: ReactNode; unit?: string; icon: ReactNode; }> = ({ title, value, unit, icon }) => (
  <div className="bg-[--background-secondary] p-3 rounded-lg border border-[--border-primary] shadow-sm">
    <div className="flex items-center gap-2 text-xs text-[--text-secondary]">
      {icon}
      <span>{title}</span>
    </div>
    <div className="mt-2 text-xl font-bold text-[--text-primary] truncate">
      {value} <span className="text-sm font-medium text-[--text-secondary]">{unit}</span>
    </div>
  </div>
);

const Terminal: FC<{ lines: LogLine[] }> = ({ lines }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight; }, [lines]);
  const typeStyles: Record<LogLine['type'], string> = {
    info: 'text-blue-400',
    ok: 'text-green-400',
    warn: 'text-yellow-400',
    error: 'text-red-400',
  };
  return (
    <div ref={terminalRef} className="bg-[#010409] font-mono text-xs p-3 rounded-md border border-[--border-primary] h-40 overflow-y-auto no-scrollbar">
      {lines.map((line, index) => (
        <div key={index} className="flex">
          <span className="text-gray-600 mr-3">{line.time}</span>
          <span className={typeStyles[line.type]}>{line.message}</span>
        </div>
      ))}
    </div>
  );
};

// --- Props ---
interface MonitoringProps {
  inventory: Nft[];
  mining: boolean;
  setMining: (mining: boolean | ((m: boolean) => boolean)) => void;
  unclaimedRewards: number;
  lastClaimTimestamp: number;
  handleClaim: () => Promise<void>;
  isClaiming: boolean;
}

// --- Component ---
export default function Monitoring({
  inventory, mining, setMining, unclaimedRewards, lastClaimTimestamp, handleClaim, isClaiming
}: MonitoringProps) {
  // ... (Hooks and logic remain the same)
  const [uptimeSec, setUptimeSec] = useState(0);
  const [targetState, setTargetState] = useState({
    ping: 0,
    totalHashrate: 0,
    totalPower: 0,
  });
  const [logLines, setLogLines] = useState<LogLine[]>([]);

  const smoothHashrate = useSmoothNumber(targetState.totalHashrate);
  const smoothPower = useSmoothNumber(targetState.totalPower);
  const uptimeStr = new Date(uptimeSec * 1000).toISOString().substr(11, 8);
  const hoursSinceLastClaim = lastClaimTimestamp > 0 ? (Date.now() - lastClaimTimestamp) / (1000 * 60 * 60) : 0;

  const addLog = (message: string, type: LogLine['type'] = 'info') => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogLines(prev => [...prev.slice(-50), { time, message, type }]);
  };

  useEffect(() => { addLog('Monitoring console initialized.', 'ok') }, []);

  const getBaseHashrate = (tier: "Basic" | "Pro" | "Legend") => ({ Basic: 1.5, Pro: 5.0, Legend: 25.0 }[tier] || 0);

  useEffect(() => {
    const uptimeInterval = setInterval(() => { if (mining) setUptimeSec(prevSec => prevSec + 1) }, 1000);
    return () => clearInterval(uptimeInterval);
  }, [mining]);

  useEffect(() => {
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const dataInterval = setInterval(() => {
      if (!mining) {
        setTargetState({ ping: 0, totalHashrate: 0, totalPower: 0 });
        return;
      }
      const newHashrate = inventory.reduce((acc, nft) => acc + getBaseHashrate(nft.tier) + rand(-0.1, 0.1) , 0);
      setTargetState({
        ping: Math.round(rand(20, 150)),
        totalHashrate: newHashrate,
        totalPower: inventory.length * 120 + newHashrate * 30 + rand(-20, 20),
      });
      if (mining && Math.random() < 0.25) addLog(`[OK] Share accepted by pool.`, 'ok');
    }, 3000);
    return () => clearInterval(dataInterval);
  }, [mining, inventory]);

   const onClaimClick = async () => {
    addLog('Claim transaction initiated...', 'info');
    try {
      await handleClaim();
      addLog('Rewards claimed successfully!', 'ok');
    } catch {
      addLog('Claim transaction failed.', 'error');
    }
  };

  const handleToggleMining = () => {
    if (hoursSinceLastClaim > 48 && !mining) {
      addLog("ACTION REQUIRED: Claim rewards to start mining.", "error");
      return;
    }
    const nextState = !mining;
    setMining(nextState);
    addLog(nextState ? 'Mining fleet online.' : 'Mining fleet offline.', nextState ? 'info' : 'warn');
  };

  return (
    <div className="p-4 space-y-4 animate-fadeInUp">
      {/* Header & Claim */}
      <div className="flex justify-between items-center bg-[--background-secondary] p-3 rounded-lg border border-[--border-primary]">
        <div>
          <p className="text-xs text-[--text-secondary]">Unclaimed Rewards</p>
          <p className="text-2xl font-bold text-amber-400">{unclaimedRewards.toFixed(4)}</p>
        </div>
        <button
          onClick={onClaimClick}
          disabled={isClaiming || unclaimedRewards <= 0}
          className="px-4 py-2 text-sm font-semibold rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-[--accent-green] text-white hover:bg-green-700"
        >
          {isClaiming ? "Claiming..." : "Claim"}
        </button>
      </div>

       {/* Warning Bar */}
       {hoursSinceLastClaim > 24 && (
        <div className={`p-3 rounded-lg text-center text-sm font-semibold flex items-center justify-center gap-2 ${
            hoursSinceLastClaim > 48 ? 'bg-red-900/50 text-red-400 border border-red-500/30' : 'bg-yellow-900/50 text-yellow-400 border border-yellow-500/30'
          }`}>
          <Icon path="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" className="w-5 h-5"/>
          {hoursSinceLastClaim > 48 ? 'MINING HALTED. Claim your rewards.' : 'Rewards should be claimed soon.'}
        </div>
      )}

      {/* Main Control & Stats */}
      <div className="bg-[--background-secondary] p-4 rounded-lg border border-[--border-primary] space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
             <div className={`w-3 h-3 rounded-full ${mining ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
             <p className="font-semibold">{mining ? 'Operation Active' : 'Operation Idle'}</p>
          </div>
          <button onClick={handleToggleMining} className={`px-5 py-2.5 text-base font-bold rounded-md transition-all duration-300 shadow-lg ${
            mining
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}>
            {mining ? "Stop Mining" : "Start Mining"}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <DataTile title="Hashrate" value={smoothHashrate.toFixed(2)} unit="H/s" icon={<Icon path="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />} />
          <DataTile title="Power" value={smoothPower.toFixed(0)} unit="W" icon={<Icon path="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />} />
          <DataTile title="Uptime" value={uptimeStr} unit="" icon={<Icon path="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />} />
        </div>
      </div>
      
       {/* Terminal */}
      <div className="space-y-2">
        <h2 className="font-semibold text-[--text-secondary] px-1">Live Log</h2>
        <Terminal lines={logLines} />
      </div>
    </div>
  );
}
