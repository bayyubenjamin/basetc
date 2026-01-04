"use client";

import { useEffect, useRef } from "react";

// Helper untuk format angka (opsional, agar ribuan ada komanya)
const fmt = (n: string) => n.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export default function TokenomicsLite() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // --- LOGIC CANVAS TETAP SAMA (Hanya container yang berubah) ---
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;

    const width = el.width;
    const height = el.height;
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(cx, cy) - 10; // Sedikit padding ekstra

    const parts = [
      { label: "Mining Rewards", value: 85.2, color: "#3B82F6" },    // Blue-500 equivalent
      { label: "Ecosystem & Liquidity", value: 10.0, color: "#10B981" }, // Emerald-500
      { label: "Treasury", value: 4.8, color: "#F59E0B" }, // Amber-500
    ];

    ctx.clearRect(0, 0, width, height);

    // Glow Effect di belakang Chart
    ctx.shadowBlur = 20;
    ctx.shadowColor = "rgba(59, 130, 246, 0.15)";

    // Background ring
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = "#0f172a"; // Slate-900
    ctx.fill();
    ctx.restore();

    ctx.shadowBlur = 0; // Reset shadow untuk elemen tajam

    let start = -Math.PI / 2;
    parts.forEach((p) => {
      const slice = (p.value / 100) * Math.PI * 2;
      const mid = start + slice / 2;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, start, start + slice);
      ctx.closePath();
      ctx.fillStyle = p.color;
      ctx.fill();

      // Divider lebih tajam
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#020617"; // Slate-950 (Background color)
      ctx.stroke();

      // Label Persentase
      const labelRadius = radius * 0.75;
      const lx = cx + Math.cos(mid) * labelRadius;
      const ly = cy + Math.sin(mid) * labelRadius;

      ctx.fillStyle = "#ffffff";
      ctx.font = "600 13px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${p.value}%`, lx, ly);

      start += slice;
    });

    // Donut hole
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = "#020617"; // Match background
    ctx.fill();

    // Center Text
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#94a3b8"; // Slate-400
    ctx.font = "500 12px Inter, sans-serif";
    ctx.fillText("Total Supply", cx, cy - 8);
    
    ctx.fillStyle = "#f8fafc"; // Slate-50
    ctx.font = "700 16px Inter, sans-serif";
    ctx.fillText("21,000,000", cx, cy + 10);

  }, []);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8 p-4 md:p-0">
      
      {/* --- TOP SECTION: CHART & SUMMARY --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left: Visualization */}
        <div className="col-span-1 bg-slate-950 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
            <canvas
              ref={canvasRef}
              width={280}
              height={280}
              className="w-[240px] h-[240px] md:w-[260px] md:h-[260px]"
            />
            {/* Legend di bawah chart */}
            <div className="flex flex-wrap justify-center gap-3 mt-4 w-full">
                <LegendItem color="bg-blue-500" label="Mining" />
                <LegendItem color="bg-emerald-500" label="Eco & LP" />
                <LegendItem color="bg-amber-500" label="Treasury" />
            </div>
        </div>

        {/* Right: Main Stats List */}
        <div className="col-span-1 md:col-span-2 flex flex-col gap-4">
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 relative">
                 <h3 className="text-lg font-bold text-white mb-1">Token Distribution</h3>
                 <p className="text-sm text-slate-400 mb-5">
                    Fixed supply <b>21,000,000</b> (18 decimals). Deflationary halving model.
                 </p>

                 <div className="space-y-3">
                    <DistributionBar 
                        label="Mining Rewards" 
                        amount="17,900,000" 
                        percent="85.2%" 
                        color="bg-blue-500"
                        desc="Distributed via NFT mining; halving every 30 days."
                    />
                    <DistributionBar 
                        label="Ecosystem & Liquidity" 
                        amount="2,100,000" 
                        percent="10.0%" 
                        color="bg-emerald-500"
                        desc="Presale, LP seeding, partnerships."
                    />
                    <DistributionBar 
                        label="Treasury (Satoshi)" 
                        amount="1,000,000" 
                        percent="4.8%" 
                        color="bg-amber-500"
                        desc="Team reserve for dev & operations."
                    />
                 </div>
            </div>
        </div>
      </div>

      {/* --- MIDDLE SECTION: NFT MECHANICS --- */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
            <h3 className="text-xl font-bold text-white">NFT Mining Mechanics</h3>
            <span className="text-xs font-medium px-2 py-1 rounded bg-slate-900 text-slate-400 border border-slate-800">
                Reward Halving: -50% / 30 Days
            </span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/50">
            <table className="w-full text-left text-sm">
                <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/50 text-slate-400">
                        <th className="px-6 py-4 font-semibold">Rig Tier</th>
                        <th className="px-6 py-4 font-semibold">Max Slots</th>
                        <th className="px-6 py-4 font-semibold">Reward Potential</th>
                        <th className="px-6 py-4 font-semibold">Est. ROI</th>
                        <th className="px-6 py-4 font-semibold">Upgrade Path</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-slate-300">
                    <tr className="hover:bg-slate-900/40 transition-colors">
                        <td className="px-6 py-4 font-medium text-white">Basic Rig</td>
                        <td className="px-6 py-4 tabular-nums">10</td>
                        <td className="px-6 py-4">0.33 $BaseTC / day</td>
                        <td className="px-6 py-4 text-emerald-400">~35 days</td>
                        <td className="px-6 py-4 text-slate-500">-</td>
                    </tr>
                    <tr className="hover:bg-slate-900/40 transition-colors bg-blue-500/[0.02]">
                        <td className="px-6 py-4 font-medium text-blue-200">Pro Rig</td>
                        <td className="px-6 py-4 tabular-nums">5</td>
                        <td className="px-6 py-4">8 $BaseTC / day</td>
                        <td className="px-6 py-4 text-emerald-400">~30 days</td>
                        <td className="px-6 py-4 text-xs">
                           Merge <b className="text-white">10 Basic</b> → 1 Pro
                        </td>
                    </tr>
                    <tr className="hover:bg-slate-900/40 transition-colors bg-amber-500/[0.02]">
                        <td className="px-6 py-4 font-medium text-amber-200">Legend Rig</td>
                        <td className="px-6 py-4 tabular-nums">3</td>
                        <td className="px-6 py-4 font-bold text-white">100 $BaseTC / day</td>
                        <td className="px-6 py-4 text-emerald-400 font-bold">~25 days</td>
                        <td className="px-6 py-4 text-xs">
                            Merge <b className="text-white">5 Pro</b> → 1 Legend
                        </td>
                    </tr>
                </tbody>
            </table>
            
            {/* Warning Box */}
            <div className="bg-slate-900/80 border-t border-slate-800 p-4 flex items-start gap-3">
                <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                <p className="text-sm text-slate-400 leading-relaxed">
                    <span className="text-amber-400 font-semibold">Legend Supply Cap:</span> Strictly limited to <strong className="text-white">3,000 NFTs</strong> (1,500 Market + 1,500 Merge). This cap will never increase.
                </p>
            </div>
        </div>
      </div>

      {/* --- BOTTOM SECTION: LEFTOVER REWARDS --- */}
      <div>
        <h3 className="text-xl font-bold text-white mb-4">Leftover Rewards Allocation</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard 
                title="Burn" 
                value="50%" 
                desc="Unmined tokens are burned forever." 
                accent="border-red-500/50" 
                textColor="text-red-400"
            />
            <StatCard 
                title="Staking Vault" 
                value="30%" 
                desc="Bonus for active stakers." 
                accent="border-indigo-500/50" 
                textColor="text-indigo-400"
            />
            <StatCard 
                title="Spin Pool" 
                value="10%" 
                desc="Daily roulette rewards." 
                accent="border-purple-500/50" 
                textColor="text-purple-400"
            />
            <StatCard 
                title="Leaderboard" 
                value="10%" 
                desc="Top 1,000 miners bonus." 
                accent="border-pink-500/50" 
                textColor="text-pink-400"
            />
        </div>
        
        {/* Example Box */}
        <div className="mt-4 p-4 rounded-xl border border-dashed border-slate-700 bg-slate-900/30 text-sm text-slate-400 text-center">
            Example: If 100,000 $BaseTC unmined → <span className="text-red-400">50k Burned</span>, <span className="text-indigo-400">30k Staking</span>, 10k Spin, 10k Leaderboard.
        </div>
      </div>

    </div>
  );
}

/* === SUB-COMPONENTS (Modern Style) === */

function LegendItem({ color, label }: { color: string, label: string }) {
    return (
        <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${color} shadow-sm`} />
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">{label}</span>
        </div>
    )
}

function DistributionBar({ label, amount, percent, color, desc }: any) {
    return (
        <div className="group p-3 rounded-xl bg-slate-900/40 hover:bg-slate-900/80 border border-transparent hover:border-slate-800 transition-all">
            <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                    <div className={`w-1 h-8 rounded-full ${color}`} />
                    <div>
                        <div className="text-sm font-semibold text-slate-200">{label}</div>
                        <div className="text-xs text-slate-500">{desc}</div>
                    </div>
                </div>
                <div className="text-right">
                    <div className={`font-bold tabular-nums text-lg leading-tight ${color.replace('bg-', 'text-').replace('500', '400')}`}>{percent}</div>
                    <div className="text-xs text-slate-400 tabular-nums">{fmt(amount)}</div>
                </div>
            </div>
            {/* Progress Bar Visual */}
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full ${color}`} style={{ width: percent }} />
            </div>
        </div>
    )
}

function StatCard({ title, value, desc, accent, textColor }: any) {
    return (
        <div className={`bg-slate-950 border border-slate-800 p-4 rounded-xl hover:border-slate-700 transition-all group relative overflow-hidden`}>
            <div className={`absolute top-0 left-0 w-full h-0.5 ${accent.replace('border-', 'bg-')}`} />
            <div className="flex justify-between items-start mb-2">
                <span className="text-slate-400 text-sm font-medium">{title}</span>
                <span className={`text-2xl font-bold ${textColor}`}>{value}</span>
            </div>
            <p className="text-xs text-slate-500 leading-snug">{desc}</p>
        </div>
    )
}
