"use client";
import { useState, FC } from 'react'; // Simplified imports for demo

const StatTile: FC<{ label: string, value: string, id: string }> = ({ label, value, id }) => (
  <div className="min-w-[160px] flex-shrink-0 snap-start bg-gradient-to-b from-tile-from to-tile-to p-2.5 rounded-lg border border-[#122a3a]">
    <div className="text-xs text-text-muted">{label}</div>
    <div className="text-base font-bold truncate" id={id}>{value}</div>
  </div>
);

export default function Monitoring() {
  const [mining, setMining] = useState(false);

  return (
    <section className="bg-gradient-to-b from-monitor-from to-monitor-to rounded-card p-2.5 border border-edge shadow-main h-full flex flex-col">
      <div className="bg-screen-bg rounded-lg border border-[#122333] p-2.5 flex flex-col gap-2.5 flex-grow">
        {/* Top Slider Stats */}
        <div className="flex gap-2 overflow-x-auto snap-x no-scrollbar">
          <StatTile label="Pool" value="stratum+tcp://pool.base:3333" id="pool" />
          <StatTile label="Total Hash" value="0.00 H/s" id="hash" />
          <StatTile label="Uptime" value="00:00:00" id="uptime" />
        </div>

        {/* Chart & Panel */}
        <div className="flex flex-col gap-2">
            <div className="w-full h-32 rounded-lg border border-[#11273a] bg-gradient-to-b from-[#061221] to-[#041018] relative">
              {/* Placeholder for chart */}
            </div>
            <div className="grid grid-cols-3 gap-2">
                 <div className="bg-gradient-to-b from-[#08141b] to-[#061018] p-2.5 rounded-lg border border-[#122b3c] col-span-2">
                    <strong className="text-xs">Pool Status</strong>
                    <div className="text-xs text-text-muted">Connected • No errors</div>
                 </div>
                 <div className="bg-gradient-to-b from-[#08141b] to-[#061018] p-2.5 rounded-lg border border-[#122b3c] text-center">
                    <strong className="text-xs">Power</strong>
                    <div className="font-bold text-lg">150 W</div>
                 </div>
            </div>
        </div>

        {/* Terminal */}
        <div className="bg-[#01060a] rounded-lg border border-[#0f2130] p-2 font-mono text-xs text-[#9fd7ff] flex-grow h-36 overflow-auto shadow-inner no-scrollbar">
          <p>[TIME] miner starting...</p>
          <p>[TIME] detecting GPUs: OK (2 devices)</p>
          <p className="text-ok">[TIME] accepted share - work 0x1234</p>
        </div>

        {/* Rig Details & Controls */}
        <div className="bg-panel p-2.5 rounded-lg border border-edge mt-auto">
             <div className="flex justify-between items-center">
                <div>
                    <strong className="text-sm">Rig Room</strong>
                    <div className="text-xs text-text-muted">2 x GPUs • fan auto</div>
                </div>
                <div className="text-xs text-text-muted">Ping <span className="text-text-primary">18 ms</span></div>
             </div>
             <table className="w-full border-collapse mt-2 text-xs">
                <thead>
                    <tr className="text-left font-bold">
                        <th className="p-1.5">GPU</th>
                        <th className="p-1.5">Temp</th>
                        <th className="p-1.5">Fan</th>
                        <th className="p-1.5">Hash</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td className="p-1.5 border-t border-dashed border-white/5">GPU 0</td>
                        <td className="p-1.5 border-t border-dashed border-white/5">45 °C</td>
                        <td className="p-1.5 border-t border-dashed border-white/5">45%</td>
                        <td className="p-1.5 border-t border-dashed border-white/5">1.10 H/s</td>
                    </tr>
                     <tr>
                        <td className="p-1.5 border-t border-dashed border-white/5">GPU 1</td>
                        <td className="p-1.5 border-t border-dashed border-white/5">46 °C</td>
                        <td className="p-1.5 border-t border-dashed border-white/5">48%</td>
                        <td className="p-1.5 border-t border-dashed border-white/5">1.05 H/s</td>
                    </tr>
                </tbody>
             </table>
             <div className="grid grid-cols-3 gap-2 mt-2">
                <button 
                  onClick={() => setMining(!mining)}
                  className="bg-gradient-to-b from-btn-from to-btn-to border border-[#263346] text-text-primary text-sm font-bold py-2 rounded-lg"
                >
                  {mining ? 'Stop' : 'Start'}
                </button>
                <button className="bg-gradient-to-b from-btn-from to-btn-to border border-[#263346] text-text-primary text-sm font-bold py-2 rounded-lg">Fan +</button>
                <button className="bg-gradient-to-b from-btn-from to-btn-to border border-[#263346] text-text-primary text-sm font-bold py-2 rounded-lg">Fan -</button>
             </div>
        </div>

      </div>
    </section>
  );
}
