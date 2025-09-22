import { FC } from 'react';
import Image from 'next/image';

// Tile kecil di bagian atas
const StatTile: FC<{ label: string; value: string; }> = ({ label, value }) => (
  <div className="min-w-[160px] flex-shrink-0 snap-start bg-gradient-to-b from-[#07121a] to-[#061018] p-2.5 rounded-xl border border-[#122a3a]">
    <div className="text-xs text-[color:var(--muted)]">{label}</div>
    <div className="text-base font-bold truncate">{value}</div>
  </div>
);

// Terminal Log
const Terminal: FC = () => (
  <div className="bg-[#01060a] rounded-lg border border-[#0f2130] p-2 font-mono text-xs text-[color:var(--accent)] h-36 overflow-auto shadow-inner no-scrollbar">
    <p><span className="text-gray-600 mr-2">13:15:50</span><span className="text-[color:var(--ok)]">Accepted share - work 0x1234...</span></p>
    <p><span className="text-gray-600 mr-2">13:15:48</span>Pool ping OK</p>
    <p><span className="text-gray-600 mr-2">13:15:45</span><span className="text-[color:var(--warn)]">Rejected share - stale</span></p>
    <p><span className="text-gray-600 mr-2">13:15:42</span>Accepted share - work 0xabcd...</p>
  </div>
);

// Komponen Utama Monitoring
export default function Monitoring() {
  return (
    <>
      {/* Panel Atas (Monitor Screen) */}
      <section className="panel flex flex-col gap-2.5">
        <div className="flex gap-2 -m-0.5 p-0.5 overflow-x-auto snap-x no-scrollbar">
          <StatTile label="Pool" value="stratum+tcp://pool.base:3333" />
          <StatTile label="Total Hash" value="2.15 H/s" />
          <StatTile label="Uptime" value="00:15:42" />
        </div>
        <div className="bg-[#041018] rounded-lg border border-[#122333] p-2.5 flex flex-col gap-2.5">
          <div className="w-full h-32 rounded-lg border border-[#11273a] bg-gradient-to-b from-[#061221] to-[#041018]" />
          <div className="grid grid-cols-[2fr_1fr] gap-2">
            <div className="bg-gradient-to-b from-[#08141b] to-[#061018] p-2.5 rounded-lg border border-[#122b3c]">
              <strong className="text-xs">Pool Status</strong>
              <div className="text-xs text-[color:var(--muted)]">Connected • No errors</div>
            </div>
            <div className="bg-gradient-to-b from-[#08141b] to-[#061018] p-2.5 rounded-lg border border-[#122b3c] text-center">
              <strong className="text-xs">Power</strong>
              <div className="font-bold text-lg">250 W</div>
            </div>
          </div>
        </div>
        <Terminal />
      </section>

      {/* Panel Bawah (Rig Room & Controls) */}
      <section className="panel">
        <div className="flex justify-between items-center">
          <div>
            <strong className="text-sm">Rig Room</strong>
            <div className="text-xs text-[color:var(--muted)]">2 x GPUs • fan auto</div>
          </div>
          <div className="text-xs text-[color:var(--muted)]">Ping <span className="text-[color:var(--text)]">18 ms</span></div>
        </div>
        
        <div className="rounded-lg overflow-hidden border border-[#223146] bg-[#06101a] mt-2">
            <Image src="/img/pro.png" alt="Mining Rigs" width={400} height={200} className="w-full h-auto" />
        </div>
        
        <table className="w-full border-collapse mt-2 text-xs text-[color:var(--muted)]">
          <thead>
            <tr className="text-left text-[color:var(--text)] font-bold">
              <th className="p-1.5 w-1/4">GPU</th>
              <th className="p-1.5 w-1/4">Temp</th>
              <th className="p-1.5 w-1/4">Fan</th>
              <th className="p-1.5 w-1/4">Hash</th>
            </tr>
          </thead>
          <tbody>
            <tr className="text-center">
              <td className="p-1.5 border-t border-dashed border-white/5 text-left">GPU 0</td>
              <td className="p-1.5 border-t border-dashed border-white/5">45 °C</td>
              <td className="p-1.5 border-t border-dashed border-white/5">45%</td>
              <td className="p-1.5 border-t border-dashed border-white/5">1.10 H/s</td>
            </tr>
            <tr className="text-center">
              <td className="p-1.5 border-t border-dashed border-white/5 text-left">GPU 1</td>
              <td className="p-1.5 border-t border-dashed border-white/5">46 °C</td>
              <td className="p-1.5 border-t border-dashed border-white/5">48%</td>
              <td className="p-1.5 border-t border-dashed border-white/5">1.05 H/s</td>
            </tr>
          </tbody>
        </table>

        <div className="grid grid-cols-3 gap-2 mt-2">
          <button className="btn">Start</button>
          <button className="btn">Fan +</button>
          <button className="btn">Fan -</button>
        </div>
      </section>
    </>
  );
}
