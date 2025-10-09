"use client";

import { useEffect, useRef } from "react";

export default function TokenomicsLite() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ctx = el.getContext("2d");
    if (!ctx) return;

    const width = el.width;
    const height = el.height;
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(cx, cy) - 8;

    const parts = [
      { label: "Mining Rewards", value: 85.2, color: "#3b82f6" },
      { label: "Ecosystem & Liquidity", value: 10.0, color: "#14b8a6" },
      { label: "Treasury (Satoshi Wallet)", value: 4.8, color: "#f59e0b" },
    ];

    ctx.clearRect(0, 0, width, height);

    // bg ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = "#0f1320";
    ctx.fill();

    // slices
    let start = -Math.PI / 2;
    parts.forEach((p) => {
      const slice = (p.value / 100) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, start, start + slice);
      ctx.closePath();
      ctx.fillStyle = p.color;
      ctx.fill();
      start += slice;
    });

    // donut hole
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.58, 0, Math.PI * 2);
    ctx.fillStyle = "#0b0d12";
    ctx.fill();

    // center text
    ctx.fillStyle = "#e5e7eb";
    ctx.font = "600 14px Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textAlign = "center";
    ctx.fillText("Token Distribution", cx, cy - 6);
    ctx.fillStyle = "#9aa3b2";
    ctx.font = "400 12px Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillText("85.2% / 10% / 4.8%", cx, cy + 12);
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1120px]">
      {/* top chart */}
      <div className="rounded-xl border border-white/10 bg-zinc-950/60 p-3 sm:p-4">
        <canvas
          ref={canvasRef}
          width={400}
          height={400}
          className="h-[260px] w-full"
          aria-label="Token distribution pie chart"
        />
      </div>

      {/* main table */}
      <div className="mt-4 rounded-xl border border-white/10 bg-zinc-950/60">
        <div className="border-b border-white/10 px-4 py-3">
          <h2 className="text-base font-semibold text-zinc-100">Main Distribution</h2>
          <p className="text-sm text-zinc-400">
            Fixed supply 21,000,000 (18 decimals). Rewards reduce by <b>50%</b> every <b>30 days</b> (halving).
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-separate border-spacing-0">
            <thead>
              <tr className="bg-white/5 text-left text-zinc-200">
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Share</th>
                <th className="px-4 py-3 font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              <Row
                cat="Mining Rewards"
                amount="17,900,000"
                share="85.2%"
                note="Distributed via NFT mining; halving every 30 days (~2 years)."
              />
              <Row
                cat="Ecosystem & Liquidity Reserve"
                amount="2,100,000"
                share="10%"
                note="Presale, LP seeding, partnerships, campaigns."
              />
              <Row
                cat="Treasury (Satoshi Wallet)"
                amount="1,000,000"
                share="4.8%"
                note="Team reserve for development, operations, marketing."
              />
              <tr className="border-t border-white/10">
                <td className="px-4 py-3 font-semibold">Total Supply</td>
                <td className="px-4 py-3 font-semibold">21,000,000 $BaseTC</td>
                <td className="px-4 py-3 font-semibold">100%</td>
                <td className="px-4 py-3 text-zinc-400">18 decimals — fixed.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* leftover */}
      <div className="mt-4 rounded-xl border border-white/10 bg-zinc-950/60">
        <div className="border-b border-white/10 px-4 py-3">
          <h2 className="text-base font-semibold text-zinc-100">Leftover Rewards (every 30 days)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-separate border-spacing-0">
            <thead>
              <tr className="bg-white/5 text-left text-zinc-200">
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Share</th>
                <th className="px-4 py-3 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              <Row2 cat="Burn" share="50%" desc="Unmined portion is burned to enforce deflation." />
              <Row2 cat="Staking Vault" share="30%" desc="Extra rewards for active stakers." />
              <Row2 cat="Spin Pool" share="10%" desc="Daily check-in (Roulette Spin)." />
              <Row2 cat="Leaderboard" share="10%" desc="Top 1,000 miners at the end of each 30-day period." />
            </tbody>
          </table>
        </div>
      </div>

      {/* tiers */}
      <div className="mt-4 rounded-xl border border-white/10 bg-zinc-950/60">
        <div className="border-b border-white/10 px-4 py-3">
          <h2 className="text-base font-semibold text-zinc-100">NFT Mining Mechanics</h2>
          <p className="text-sm text-zinc-400">
            Rewards reduce by <b>50%</b> every <b>30 days</b>. Upgrades/repairs require $BaseTC (burn/LP sink).
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-separate border-spacing-0">
            <thead>
              <tr className="bg-white/5 text-left text-zinc-200">
                <th className="px-4 py-3 font-semibold">Tier</th>
                <th className="px-4 py-3 font-semibold">Max Slots / User</th>
                <th className="px-4 py-3 font-semibold">Reward per Day</th>
                <th className="px-4 py-3 font-semibold">ROI (approx)</th>
                <th className="px-4 py-3 font-semibold">Upgrade Path</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              <Row2 cat="Basic Rig" share="10" desc="1 Basic = 0.333 $BaseTC / day (≈ 3.33 with 10 slots)" />
              <Row2 cat="Pro Rig" share="5" desc="1 Pro = 8 $BaseTC / day (≈ 40 with 5 slots) • 10 Basic → 1 Pro (+$BaseTC fee)" />
              <Row2 cat="Legend Rig" share="3" desc="1 Legend = 100 $BaseTC / day (≈ 300 with 3 slots) • 5 Pro → 1 Legend (+$BaseTC fee)" />
              <tr className="border-t border-white/10">
                <td className="px-4 py-3 font-medium">Supreme (Status)</td>
                <td className="px-4 py-3">1</td>
                <td className="px-4 py-3">Bonus reward tier (Full Farm)</td>
                <td className="px-4 py-3">—</td>
                <td className="px-4 py-3">3 Legend → Supreme status</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* legend cap */}
        <div className="px-4 py-4">
          <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-amber-100">
            <b>Legend Supply is strictly limited to 3,000 NFTs</b> — 1,500 Market Sale + 1,500 via Merge. This cap will never increase.
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ cat, amount, share, note }: { cat: string; amount: string; share: string; note: string }) {
  return (
    <tr className="border-b border-white/10 last:border-b-0">
      <td className="px-4 py-3">{cat}</td>
      <td className="px-4 py-3">{amount}</td>
      <td className="px-4 py-3 font-semibold">{share}</td>
      <td className="px-4 py-3 text-zinc-400">{note}</td>
    </tr>
  );
}

function Row2({ cat, share, desc }: { cat: string; share: string; desc: string }) {
  return (
    <tr className="border-b border-white/10 last:border-b-0">
      <td className="px-4 py-3">{cat}</td>
      <td className="px-4 py-3 font-semibold">{share}</td>
      <td className="px-4 py-3 text-zinc-400">{desc}</td>
    </tr>
  );
}