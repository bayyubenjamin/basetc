// app/components/Tokenomics.tsx
"use client";

import { useEffect, useMemo, useRef } from "react";

/**
 * $BaseTC — Tokenomics & NFT Mechanics
 * - Self-contained JSX (no CDN)
 * - Canvas pie chart rendered in useEffect
 * - Clean, readable structure & copy
 */
export default function Tokenomics() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // —— Core numbers (easy to tweak later) ——
  const totalSupply = 21_000_000;
  const split = useMemo(
    () => [
      { label: "Mining Rewards", value: 85.2, colorVar: "--blue" },
      { label: "Ecosystem & Liquidity", value: 10.0, colorVar: "--teal" },
      { label: "Treasury (Satoshi Wallet)", value: 4.8, colorVar: "--gold" },
    ],
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const css = getComputedStyle(document.documentElement);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(cx, cy) - 10;

    // bg
    ctx.clearRect(0, 0, width, height);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = "#0c1220";
    ctx.fill();

    // slices
    let start = -Math.PI / 2;
    split.forEach((s) => {
      const color = css.getPropertyValue(s.colorVar).trim() || "#999";
      const slice = (s.value / 100) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, start, start + slice);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      start += slice;
    });

    // donut hole
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.56, 0, Math.PI * 2);
    ctx.fillStyle = "#0b0d12";
    ctx.fill();

    // center labels
    ctx.fillStyle = "#cfd7e6";
    ctx.font = "600 15px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial";
    ctx.textAlign = "center";
    ctx.fillText("Token Distribution", cx, cy - 6);

    ctx.fillStyle = "#9aa3b2";
    ctx.font = "400 13px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial";
    ctx.fillText("85.2% / 10% / 4.8%", cx, cy + 12);
  }, [split]);

  return (
    <div className="wrap">
      <header className="hdr">
        <span className="dot" />
        <h1>$BaseTC — Tokenomics &amp; NFT Mechanics</h1>
      </header>
      <p className="sub">Clean on-chain mining economy with 30-day halving and deflationary sinks.</p>

      {/* ——— Pie + main table ——— */}
      <div className="card">
        <div className="grid grid-2">
          <div>
            <canvas
              ref={canvasRef}
              id="pie"
              width={560}
              height={360}
              aria-label="Token distribution pie chart"
            />
          </div>
          <div>
            <h2>Main Distribution</h2>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Share</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <span className="badge badgeBlue">Mining Rewards</span>
                  </td>
                  <td>17,900,000</td>
                  <td><strong>85.2%</strong></td>
                  <td>Distributed via NFT mining. Rewards reduce by <b>50%</b> every <b>30 days</b> (halving), ~2 years.</td>
                </tr>
                <tr>
                  <td>
                    <span className="badge badgeTeal">Ecosystem &amp; Liquidity Reserve</span>
                  </td>
                  <td>2,100,000</td>
                  <td><strong>10%</strong></td>
                  <td>Presale, LP seeding, partnerships, campaigns — price &amp; growth stability.</td>
                </tr>
                <tr>
                  <td>
                    <span className="badge badgeGold">Treasury (Satoshi Wallet)</span>
                  </td>
                  <td>1,000,000</td>
                  <td><strong>4.8%</strong></td>
                  <td>Core team reserve for development, operations, marketing.</td>
                </tr>
                <tr>
                  <td><b>Total Supply</b></td>
                  <td><b>{totalSupply.toLocaleString()} $BaseTC</b></td>
                  <td><b>100%</b></td>
                  <td className="mono">18 decimals — fixed supply.</td>
                </tr>
              </tbody>
            </table>

            <div className="legend">
              <Legend color="var(--blue)" label="Mining Rewards (85.2%)" />
              <Legend color="var(--teal)" label="Ecosystem & Liquidity (10%)" />
              <Legend color="var(--gold)" label="Treasury (4.8%)" />
            </div>
          </div>
        </div>
      </div>

      {/* ——— Leftover split ——— */}
      <section>
        <h2>Leftover Rewards (every 30 days)</h2>
        <table className="tbl">
          <thead>
            <tr>
              <th>Category</th>
              <th>Share</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Burn</td><td><b>50%</b></td><td>Unmined portion is burned to enforce deflation.</td></tr>
            <tr><td>Staking Vault</td><td><b>30%</b></td><td>Boosts staking rewards for active holders.</td></tr>
            <tr><td>Spin Pool</td><td><b>10%</b></td><td>Daily check-in rewards (Roulette Spin).</td></tr>
            <tr><td>Leaderboard</td><td><b>10%</b></td><td>Distributed to the Top 1,000 miners at the close of each 30-day period.</td></tr>
          </tbody>
        </table>
        <p className="tip">
          <b>Example:</b> If 100,000 $BaseTC remain unmined → 🔥 50,000 burned, 💎 30,000 to staking, 🎰 10,000 to spin, 🏆 10,000 to leaderboard.
        </p>
      </section>

      {/* ——— NFT mechanics ——— */}
      <section>
        <h2>NFT Mining Mechanics</h2>

        <div className="callout">
          <span className="ico">💡</span>
          <div>
            Rewards reduce by <b>50%</b> every <b>30 days</b> (halving). All upgrade / merge / repair actions require $BaseTC — a portion can be burned or routed to LP to stabilize price.
          </div>
        </div>

        <h3 className="caps" style={{ marginTop: 16 }}>Tier Structure (before the first 30-day halving)</h3>
        <table className="tbl">
          <thead>
            <tr>
              <th>Tier</th>
              <th>Max Slots / User</th>
              <th>Reward per Day</th>
              <th>ROI (approx)</th>
              <th>Upgrade Path</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><b>Basic Rig</b></td>
              <td>10</td>
              <td><b>1 Basic = 0.333 $BaseTC / day</b> <span className="tip">(≈ 3.33 $BaseTC with 10 slots)</span></td>
              <td>~35 days</td>
              <td>—</td>
            </tr>
            <tr>
              <td><b>Pro Rig</b></td>
              <td>5</td>
              <td><b>1 Pro = 8 $BaseTC / day</b> <span className="tip">(≈ 40 $BaseTC with 5 slots)</span></td>
              <td>~30 days</td>
              <td>10 Basic → 1 Pro <span className="mono">(+ $BaseTC fee)</span></td>
            </tr>
            <tr>
              <td><b>Legend Rig</b></td>
              <td>3</td>
              <td><b>1 Legend = 100 $BaseTC / day</b> <span className="tip">(≈ 300 $BaseTC with 3 slots)</span></td>
              <td>~25 days</td>
              <td>5 Pro → 1 Legend <span className="mono">(+ $BaseTC fee)</span></td>
            </tr>
            <tr>
              <td><b>Supreme (Status)</b></td>
              <td>1</td>
              <td>Bonus reward tier (Full Farm Status)</td>
              <td>—</td>
              <td>3 Legend → Supreme status</td>
            </tr>
          </tbody>
        </table>

        <div className="callout" style={{ marginTop: 14 }}>
          <span className="ico">⚠️</span>
          <div>
            <b>Legend Supply is strictly limited to 3,000 NFTs</b> — <span className="hi">1,500 Market Sale</span> + <span className="hi">1,500 via Merge</span>. This cap will never increase.
          </div>
        </div>

        <h3 className="caps" style={{ marginTop: 18 }}>Economy Flow</h3>
        <p>
          <b>NFT Activity (Mint / Merge / Repair)</b> → <b>Token Utility ($BaseTC)</b> → <b>Burn / LP Injection</b> → <b>Price stabilization</b> → Sustainable ROI &amp; growth.
        </p>
      </section>

      <style jsx>{`
        :root{
          --bg:#0b0d12; --panel:#121622; --muted:#9aa3b2; --text:#e8eef6;
          --blue:#3b82f6;    /* Mining Rewards */
          --teal:#14b8a6;    /* Ecosystem & Liquidity Reserve */
          --gold:#f59e0b;    /* Treasury (Satoshi Wallet) */
          --accent:#7c8bff;
          --card:#0f1320; --border:#1f2536;
        }
        .wrap{max-width:1080px; margin:0 auto; padding:24px; background:var(--bg); color:var(--text)}
        .hdr{display:flex; align-items:center; gap:14px; margin:10px 0 18px}
        .dot{width:9px;height:9px;border-radius:50%;background:var(--accent)}
        h1{font-size:26px; margin:0; letter-spacing:.2px}
        .sub{color:var(--muted)}
        .card{background:var(--panel); border:1px solid var(--border); border-radius:14px; padding:18px; margin-top:16px}
        .grid{display:grid; gap:16px}
        .grid-2{grid-template-columns: 1.1fr .9fr}
        @media(max-width: 959px){ .grid-2{grid-template-columns: 1fr} }
        h2{font-size:20px;margin:0 0 10px}
        section{margin:28px 0}
        .tbl{width:100%; border-collapse: collapse; overflow:hidden; border-radius:12px; border:1px solid var(--border); background:var(--panel)}
        .tbl th, .tbl td{padding:12px 12px; border-bottom:1px solid var(--border); vertical-align:top}
        .tbl th{background:rgba(255,255,255,.02); text-align:left; color:#cfd7e6; font-weight:600}
        .tbl tr:last-child td{border-bottom:0}
        .badge{display:inline-block; padding:2px 8px; border-radius:999px; border:1px solid var(--border); background:var(--card); color:#dbe2f0; font-size:12px}
        .badgeBlue{background:rgba(59,130,246,.15); border-color:transparent; color:#cfe1ff}
        .badgeTeal{background:rgba(20,184,166,.15); border-color:transparent; color:#a6ffee}
        .badgeGold{background:rgba(245,158,11,.15); border-color:transparent; color:#ffe3a3}
        .legend{display:flex; flex-wrap:wrap; gap:12px; margin-top:12px}
        .legitem{display:flex; align-items:center; gap:8px; padding:6px 10px; background:var(--card); border:1px solid var(--border); border-radius:10px;}
        .sw{width:12px;height:12px;border-radius:3px}
        .tip{font-size:13px;color:var(--muted)}
        .caps{letter-spacing:.4px; text-transform:uppercase; font-size:12px; color:#cbd5e1}
        .mono{font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace}
        .callout{display:flex; gap:12px; align-items:flex-start; background:linear-gradient(0deg, rgba(255,255,255,.02), rgba(255,255,255,.02)), var(--panel); border:1px dashed var(--border); padding:14px; border-radius:12px}
        .ico{font-size:18px}
      `}</style>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="legitem">
      <span className="sw" style={{ background: `var(${color})` }} />
      <span>{label}</span>
      <style jsx>{`
        .legitem{display:flex; align-items:center; gap:8px; padding:6px 10px; background:var(--card); border:1px solid var(--border); border-radius:10px}
        .sw{width:12px;height:12px;border-radius:3px}
      `}</style>
    </div>
  );
}