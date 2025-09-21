"use client";
import { useEffect, useRef, useState, FC, ReactNode } from "react";

// --- Helper & Sub-Components (dibuat agar kode utama lebih bersih) ---

// Komponen Ikon sederhana untuk mempercantik UI
const Icon = ({ path, className = "w-4 h-4" }: { path: string; className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

// Komponen untuk kartu stat utama (Pool, Total Hash, Uptime)
const StatCard = ({ title, value, iconPath }: { title: string; value: string | ReactNode; iconPath: string }) => (
  <div className="min-w-[120px] flex-1 rounded-lg border border-[#122a3a] bg-gradient-to-b from-[#07121a] to-[#061018] p-3">
    <div className="flex items-center gap-2 text-sm text-[#9aacc6]">
      <Icon path={iconPath} />
      <span>{title}</span>
    </div>
    <div className="mt-1 text-lg font-extrabold text-white">{value}</div>
  </div>
);

// Komponen untuk tile data yang lebih kecil
const DataTile = ({ title, value, color = "text-white" }: { title: string; value: string | ReactNode; color?: string }) => (
    <div className="rounded-md border border-[#122b3c] bg-gradient-to-b from-[#08141b] to-[#061018] p-2 h-full flex flex-col justify-center">
        <div className="text-xs font-semibold text-[#9aacc6]">{title}</div>
        <div className={`text-sm font-bold ${color}`}>{value}</div>
    </div>
);


// Komponen Sparkline Chart (tidak berubah, hanya dipindahkan)
const Sparkline = ({ mining }: { mining: boolean }) => {
  const ref = useRef<SVGPathElement>(null);
  useEffect(() => {
    const pts = Array.from({ length: 60 }, (_, i) => 70 + Math.sin(i / 6) * 10);
    let alive = true;
    const tick = () => {
      if (!alive) return;
      const last = pts[pts.length - 1];
      const next = last + (Math.random() - 0.5) * 2.2 + (mining ? 0.7 : -0.5);
      pts.push(Math.max(20, Math.min(100, next)));
      if (pts.length > 60) pts.shift();
      if (ref.current) {
        const d = pts.map((y, i) => `${i ? "L" : "M"} ${i * 5} ${y}`).join(" ");
        ref.current.setAttribute("d", d);
      }
      setTimeout(tick, 250);
    };
    tick();
    return () => { alive = false; };
  }, [mining]);
  return (
    <svg viewBox="0 0 300 120" className="w-full h-full">
      <defs>
        <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#5ad6ff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#5ad6ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path ref={ref} d="M 0 70" className="stroke-[#5ad6ff]" strokeWidth="2" fill="url(#g)" />
    </svg>
  );
};


// --- Komponen Utama Monitoring ---

export default function Monitoring() {
  // State management tetap sama
  const [mining, setMining] = useState(true);
  const [sec, setSec] = useState(0);
  const [bal, setBal] = useState(12345);
  const [fanBias, setFanBias] = useState(0);
  const [hash, setHash] = useState("0.00 H/s");
  const [power, setPower] = useState("0 W");
  const [ping, setPing] = useState(0);
  const [lastShare, setLastShare] = useState("—");
  const [gpus, setGpus] = useState([
    { id: 0, temp: "45 °C", fan: "45%", hash: "1.10 H/s" },
    { id: 1, temp: "46 °C", fan: "48%", hash: "1.05 H/s" },
  ]);

  const uptime = new Date(sec * 1000).toISOString().substr(11, 8);

  // Simulasi data (logika tidak diubah, hanya state `gpus` yang di-refactor)
  useEffect(() => {
    let alive = true;
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const step = () => {
      if (!alive) return;
      setSec((s) => s + 1);
      setPing(Math.round(rand(18, 120)));

      const newGpus = gpus.map((gpu, i) => {
        const baseTemp = 40 + Math.sin((sec + i * 5) / (12 + i)) * (2 + i);
        const fan = Math.max(18, Math.min(100, Math.round(38 + (baseTemp - 40) * 3 + fanBias + rand(-3, 3))));
        const hash = (1.0 + i * 0.05 + (fan / 100) * 0.55 + rand(-0.05, 0.05)).toFixed(2);
        return {
          id: i,
          temp: `${(baseTemp + (mining ? 4 : 0)).toFixed(1)} °C`,
          fan: `${fan}%`,
          hash: `${hash} H/s`,
        };
      });
      setGpus(newGpus);

      const totalHash = newGpus.reduce((acc, gpu) => acc + parseFloat(gpu.hash), 0).toFixed(2);
      setHash(`${totalHash} H/s`);
      
      const totalFan = newGpus.reduce((acc, gpu) => acc + parseInt(gpu.fan), 0);
      const avgFan = totalFan / newGpus.length;
      const pw = Math.round(150 + avgFan * 1.1 + parseFloat(totalHash) * 40);
      setPower(`${pw} W`);

      if (mining && Math.random() < 0.6) {
        const wid = Math.random().toString(16).slice(2, 10);
        setLastShare(`${Math.round(rand(0, 3))}s ago • 0x${wid}`);
      }
      setTimeout(step, 900);
    };
    step();
    return () => { alive = false; };
  }, [mining, fanBias, sec]);

  return (
    <div className="mx-auto max-w-[430px] px-3 pb-4 pt-3 flex-grow space-y-3">
        {/* Header di-refactor sedikit */}
        <header className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
                <div className="h-9 w-9 flex-shrink-0 rounded-md border border-[#25344a] bg-gradient-to-b from-[#0f1924] to-[#071017] shadow-lg" />
                <div>
                    <div className="font-bold leading-tight">BaseTC Console</div>
                    <div className="text-xs text-[#9aacc6]">professional • dark-fun</div>
                </div>
            </div>
            <div className="flex items-center gap-1 rounded-full border border-[#233045] bg-gradient-to-b from-[#0f1622] to-[#0a1119] p-1 text-xs text-[#9aacc6]">
                <span className="pl-2 opacity-80">Bal:</span>
                <strong className="text-white font-bold">{bal.toLocaleString()}</strong>
                <button className="rounded-full bg-[#0f2432] border border-[#30435e] px-3 py-1 text-xs font-semibold text-white">
                    Claim
                </button>
            </div>
        </header>

        {/* Monitor Card */}
        <section className="rounded-xl border border-[#202838] bg-gradient-to-b from-[#0f1622] to-[#0c1119] p-2 shadow-lg">
            <div className="rounded-lg border border-[#122333] bg-[#041018] p-2 space-y-2">
                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                    <StatCard title="Pool" value={<span className="text-sm">stratum+tcp://base:3333</span>} iconPath="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                    <StatCard title="Total Hashrate" value={hash} iconPath="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                    <StatCard title="Uptime" value={uptime} iconPath="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="md:col-span-2 rounded-md border border-[#11273a] bg-gradient-to-b from-[#061221] to-[#041018] h-32">
                        <Sparkline mining={mining} />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-1 gap-2">
                       <DataTile title="Last Share" value={<span className="text-xs truncate">{lastShare}</span>} />
                       <DataTile title="Power" value={power} color="text-yellow-400" />
                       <DataTile title="Pool Status" value={<div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-400"></div><span>Connected</span></div>} color="text-green-400" />
                    </div>
                </div>
            </div>
        </section>

        {/* Rig Panel */}
        <section className="rounded-xl border border-[#182737] bg-gradient-to-b from-[#0f1622] to-[#0b1118] p-3 shadow-lg">
            <div className="mb-2 flex items-center justify-between">
                <div>
                    <div className="text-sm font-semibold">Mining Farm Status</div>
                    <div className="text-xs text-[#9aacc6]">{gpus.length} × GPUs Online • Fan Auto</div>
                </div>
                <div className="text-xs text-[#9aacc6]">Ping: {ping} ms</div>
            </div>

            <div className="overflow-hidden rounded-lg border border-[#223146] bg-[#06101a]">
                <img src="/img/pro.png" alt="Rig room" className="w-full" />
            </div>

            <table className="mt-2 w-full border-collapse text-sm">
                <thead>
                    <tr className="text-left text-xs font-semibold text-[#9aacc6]">
                        <th className="p-2">Unit</th>
                        <th className="p-2 text-center">Temp.</th>
                        <th className="p-2 text-center">Fan Speed</th>
                        <th className="p-2 text-right">Hashrate</th>
                    </tr>
                </thead>
                <tbody className="[&>tr>td]:border-t [&>tr>td]:border-white/5">
                    {gpus.map(gpu => (
                        <tr key={gpu.id}>
                            <td className="p-2 font-mono text-[#9aacc6]">GPU_{gpu.id}</td>
                            <td className="p-2 text-center font-mono text-green-400">{gpu.temp}</td>
                            <td className="p-2 text-center font-mono text-blue-400">{gpu.fan}</td>
                            <td className="p-2 text-right font-mono text-white">{gpu.hash}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="mt-3 grid grid-cols-3 gap-2">
                <button onClick={() => setMining(m => !m)} className={`rounded-lg border  px-3 py-2 text-sm font-semibold transition-all ${mining ? 'border-red-500/50 bg-red-500/10 text-red-400' : 'border-[#263346] bg-gradient-to-b from-[#111827] to-[#0e1620]'}`}>
                    {mining ? "Stop Mining" : "Start Mining"}
                </button>
                <button onClick={() => setFanBias(b => b + 6)} className="rounded-lg border border-[#263346] bg-gradient-to-b from-[#111827] to-[#0e1620] px-3 py-2 text-sm font-semibold">Fan +</button>
                <button onClick={() => setFanBias(b => Math.max(-30, b - 6))} className="rounded-lg border border-[#263346] bg-gradient-to-b from-[#111827] to-[#0e1620] px-3 py-2 text-sm font-semibold">Fan −</button>
            </div>
        </section>
    </div>
  );
}
