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
    const height = el.height; // (tersisa kalau nanti perlu)
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(cx, cy) - 8;

    // Premium palette (mewah & konsisten)
    const parts = [
      { label: "Mining Rewards", value: 85.2, color: "#4F7CFF" },    // royal cobalt
      { label: "Ecosystem & Liquidity", value: 10.0, color: "#1CC7A0" }, // emerald
      { label: "Treasury (Satoshi Wallet)", value: 4.8, color: "#FFB23D" }, // warm amber
    ];

    ctx.clearRect(0, 0, width, height);

    // Background ring (deep navy) + subtle shadow
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = "#0a0f1a";
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.restore();


    // Slices + labels di atas tiap slice
    let start = -Math.PI / 2;
    parts.forEach((p) => {
      const slice = (p.value / 100) * Math.PI * 2;
      const mid = start + slice / 2;

      // segmen
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, start, start + slice);
      ctx.closePath();
      ctx.fillStyle = p.color;
      ctx.fill();

      // divider tipis
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.stroke();

      // label persen di atas slice
      const labelRadius = radius * 0.78;
      const lx = cx + Math.cos(mid) * labelRadius;
      const ly = cy + Math.sin(mid) * labelRadius;

      ctx.fillStyle = "#f3f4f6";
      ctx.font = "500 12px Inter, ui-sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${p.value}%`, lx, ly);

      start += slice;
    })

    // Donut hole (graphite)
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.58, 0, Math.PI * 2);
    ctx.fillStyle = "#0c111d";
    ctx.fill();

    // === Center Text (diturunkan dikit + font 1px lebih kecil) ===
ctx.textAlign = "center";
ctx.textBaseline = "middle";

// Judul
ctx.fillStyle = "#e6ebf5";
ctx.font = "600 14px Inter, ui-sans-serif";
ctx.fillText("Token Distribution", cx, cy - 6);

// Label per sektor (warna mengikuti pie) — diturunkan 6px total
ctx.font = "500 11px Inter, ui-sans-serif";
const labels = [
  { text: "Mining", color: "#4F7CFF", offset: 8 },
  { text: "Eco & LP", color: "#1CC7A0", offset: 22 },
  { text: "Treasury", color: "#FFB23D", offset: 36 },
] as const;

labels.forEach((l) => {
  ctx.fillStyle = l.color;
  ctx.fillText(l.text, cx, cy + l.offset);
});
  }, []); // ⬅️ PENTING: tutup useEffect di sini

  return (
    <div className="mx-auto w-full max-w-[1120px]">
      {/* Pie Chart (container premium) */}
      <div className="rounded-xl border border-white/10 bg-gradient-to-b from-[#0b0f1a]/85 to-[#0b0f1a]/60 p-3 sm:p-4 shadow-[0_6px_24px_rgba(0,0,0,0.25)]">
        <canvas
          ref={canvasRef}
          width={400}
          height={400}
          className="h-[280px] w-[280px] mx-auto sm:h-[340px] sm:w-[340px]"
          aria-label="Token distribution pie chart"
        />
      </div>

      {/* Main Distribution */}
      <Section
        title="Main Distribution"
        desc={
          <>
            Fixed supply <b>21,000,000</b> (18 decimals). Rewards reduce by <b>50%</b> every <b>30 days</b> (halving).
          </>
        }
      >
        <table className="w-full min-w-[720px] border-separate border-spacing-0">
          <TableHead cols={["Category", "Amount", "Share", "Notes"]} />
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
              <td className="px-4 py-3 font-semibold tabular-nums">21,000,000 $BaseTC</td>
              <td className="px-4 py-3 font-semibold">100%</td>
              <td className="px-4 py-3 text-zinc-400">18 decimals — fixed.</td>
            </tr>
          </tbody>
        </table>
      </Section>

      {/* Leftover Rewards */}
      <Section title="Leftover Rewards (every 30 days)">
        <table className="w-full min-w-[680px] border-separate border-spacing-0">
          <TableHead cols={["Category", "Share", "Description"]} />
          <tbody className="text-zinc-300">
            <Row2 cat="Burn" share="50%" desc="Unmined portion is burned to enforce deflation." />
            <Row2 cat="Staking Vault" share="30%" desc="Extra rewards for active stakers." />
            <Row2 cat="Spin Pool" share="10%" desc="Daily check-in (Roulette Spin)." />
            <Row2 cat="Leaderboard" share="10%" desc="Top 1,000 miners at the end of each 30-day period." />
          </tbody>
        </table>

        {/* Example */}
        <div className="mt-3 rounded-lg bg-[#0e1424]/70 ring-1 ring-white/10 px-4 py-3 text-sm text-zinc-300">
          <span className="opacity-90 font-semibold">Example:</span>{" "}
          If 100,000 $BaseTC remain unmined → <span className="text-red-300">50,000 burned</span>,{" "}
          <span className="text-emerald-300">30,000 to staking rewards</span>, 10,000 to Spin Pool, 10,000 to Leaderboard.
        </div>
      </Section>

      {/* NFT Mechanics */}
      <Section
        title="NFT Mining Mechanics"
        desc={
          <>
            Rewards reduce by <b>50%</b> every <b>30 days</b>. Upgrades and repairs require $BaseTC (burn or LP sink).
          </>
        }
      >
        <table className="w-full min-w-[820px] border-separate border-spacing-0">
          <TableHead cols={["Tier", "Max Slots / User", "Reward per Day", "ROI (approx)", "Upgrade Path"]} />
          <tbody className="text-zinc-300">
            <RowNFT
              tier="Basic Rig"
              slots="10"
              reward="1 Basic = 0.333 $BaseTC / day (≈ 3.33 with 10 slots)"
              roi="~35 days"
              path="-"
            />
            <RowNFT
              tier="Pro Rig"
              slots="5"
              reward="1 Pro = 8 $BaseTC / day (≈ 40 with 5 slots)"
              roi="~30 days"
              path="🔹 10 Basic → 1 Pro (+$BaseTC fee)"
            />
            <RowNFT
              tier="Legend Rig"
              slots="3"
              reward="1 Legend = 100 $BaseTC / day (≈ 300 with 3 slots)"
              roi="~25 days"
              path="🔹 5 Pro → 1 Legend (+$BaseTC fee)"
            />
            <tr className="border-t border-white/10">
              <td className="px-4 py-3 font-medium">Supreme (Status)</td>
              <td className="px-4 py-3">1</td>
              <td className="px-4 py-3">Bonus reward tier (Full Farm)</td>
              <td className="px-4 py-3">—</td>
              <td className="px-4 py-3">3 Legend → Supreme status</td>
            </tr>
          </tbody>
        </table>

        <div className="px-4 py-4">
          <div className="rounded-lg border border-amber-300/30 bg-gradient-to-br from-amber-400/10 to-amber-300/5 px-4 py-3 text-amber-100 text-sm leading-relaxed">
            <b>Legend Supply is strictly limited to 3,000 NFTs</b> — 1,500 Market Sale + 1,500 via Merge. This cap will <u>never</u> increase.
          </div>
        </div>
      </Section>
    </div>
  );
}

/* === Components === */

function Section({ title, desc, children }: { title: string; desc?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-gradient-to-b from-[#0b0f1a]/80 to-[#0b0f1a]/55">
      <div className="border-b border-white/10 px-4 py-3">
        <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
        {desc && <p className="text-sm text-zinc-400">{desc}</p>}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function TableHead({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr className="bg-white/[.06] text-left text-zinc-200">
        {cols.map((c, i) => (
          <th key={i} className="px-4 py-3 font-semibold">
            {c}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function Row({ cat, amount, share, note }: { cat: string; amount: string; share: string; note: string }) {
  return (
    <tr className="border-b border-white/10 last:border-b-0 hover:bg-white/5 transition-colors">
      <td className="px-4 py-3">{cat}</td>
      <td className="px-4 py-3 tabular-nums">{amount}</td>
      <td className="px-4 py-3 font-semibold text-[#7FB2FF]">{share}</td>
      <td className="px-4 py-3 text-zinc-400">{note}</td>
    </tr>
  );
}

function Row2({ cat, share, desc }: { cat: string; share: string; desc: string }) {
  return (
    <tr className="border-b border-white/10 last:border-b-0 hover:bg-white/5 transition-colors">
      <td className="px-4 py-3">{cat}</td>
      <td className="px-4 py-3 font-semibold text-[#FACC6B]">{share}</td>
      <td className="px-4 py-3 text-zinc-400">{desc}</td>
    </tr>
  );
}

function RowNFT({
  tier,
  slots,
  reward,
  roi,
  path,
}: {
  tier: string;
  slots: string;
  reward: string;
  roi: string;
  path: string;
}) {
  return (
    <tr className="border-b border-white/10 last:border-b-0 hover:bg-white/5 transition-colors">
      <td className="px-4 py-3">{tier}</td>
      <td className="px-4 py-3 tabular-nums">{slots}</td>
      <td className="px-4 py-3 text-zinc-300">{reward}</td>
      <td className="px-4 py-3 text-zinc-300">{roi}</td>
      <td className="px-4 py-3 text-zinc-400">{path}</td>
    </tr>
  );
}