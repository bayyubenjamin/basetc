"use client";
import { useEffect, useRef, useState } from "react";

function Sparkline({ mining }: { mining: boolean }) {
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
    return () => {
      alive = false;
    };
  }, [mining]);
  return (
    <svg viewBox="0 0 300 120" className="w-full h-28">
      <defs>
        <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#5ad6ff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#5ad6ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path ref={ref} className="stroke-[#5ad6ff]" strokeWidth="2" fill="none" />
    </svg>
  );
}

export default function Page() {
  // ---- state (dummy dulu) ----
  const [mining, setMining] = useState(false);
  const [sec, setSec] = useState(0);
  const [bal, setBal] = useState(12345);
  const [fanBias, setFanBias] = useState(0);

  const [hash, setHash] = useState("0.00 H/s");
  const [power, setPower] = useState("0 W");
  const [ping, setPing] = useState(0);
  const [lastShare, setLastShare] = useState("—");

  const [g0t, setG0t] = useState("45 °C");
  const [g1t, setG1t] = useState("46 °C");
  const [g0f, setG0f] = useState("45%");
  const [g1f, setG1f] = useState("48%");
  const [g0h, setG0h] = useState("1.10 H/s");
  const [g1h, setG1h] = useState("1.05 H/s");

  // uptime
  const hh = String(Math.floor(sec / 3600)).padStart(2, "0");
  const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  const uptime = `${hh}:${mm}:${ss}`;

  // simulate
  useEffect(() => {
    let alive = true;
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const step = () => {
      if (!alive) return;
      setSec((s) => s + 1);

      const p = Math.round(rand(18, 120));
      setPing(p);

      const baseTemp0 = 40 + Math.sin((sec + 1) / 12) * 2;
      const baseTemp1 = 41 + Math.cos((sec + 1) / 10) * 2.1;
      const fan0 = Math.max(18, Math.min(100, Math.round(38 + (baseTemp0 - 40) * 3 + fanBias + rand(-3, 3))));
      const fan1 = Math.max(18, Math.min(100, Math.round(38 + (baseTemp1 - 40) * 3 + fanBias + rand(-3, 3))));
      const _g0h = (1.0 + (fan0 / 100) * 0.55 + rand(-0.05, 0.05)).toFixed(2);
      const _g1h = (0.96 + (fan1 / 100) * 0.53 + rand(-0.05, 0.05)).toFixed(2);

      setG0t(`${(baseTemp0 + (mining ? 4 : 0)).toFixed(1)} °C`);
      setG1t(`${(baseTemp1 + (mining ? 4 : 0)).toFixed(1)} °C`);
      setG0f(`${fan0}%`);
      setG1f(`${fan1}%`);
      setG0h(`${_g0h} H/s`);
      setG1h(`${_g1h} H/s`);

      const totalHash = (parseFloat(_g0h) + parseFloat(_g1h)).toFixed(2);
      setHash(`${totalHash} H/s`);

      const pw = Math.round(150 + (fan0 + fan1) / 2 * 1.1 + parseFloat(totalHash) * 40);
      setPower(`${pw} W`);

      if (mining && Math.random() < 0.6) {
        const wid = Math.random().toString(16).slice(2, 10);
        setLastShare(`${Math.round(rand(0, 3))}s ago • 0x${wid}`);
      }
      setTimeout(step, 900);
    };
    step();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mining, fanBias, sec]);

  return (
    <main className="min-h-dvh bg-[#0b0e12] text-[#e9eef7]">
      {/* app shell */}
      <div className="mx-auto max-w-[430px] px-3 pb-[92px] pt-[12px]">
        {/* header */}
        <header className="grid grid-cols-[1fr_auto] items-center gap-2">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-md border border-[#25344a] bg-gradient-to-b from-[#0f1924] to-[#071017] shadow-[0_12px_32px_rgba(0,0,0,.28),inset_0_1px_0_rgba(255,255,255,.02)]" />
            <div>
              <div className="text-[13px] font-bold leading-tight">BaseTC Mining Console</div>
              <div className="text-[11px] text-[#9aacc6]">professional • dark-fun</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-2xl border border-[#233045] bg-gradient-to-b from-[#0f1622] to-[#0a1119] px-2.5 py-1.5 text-[12px] text-[#9aacc6]">
              <span className="opacity-80">Balance</span>
              <strong className="text-[#e9eef7]">{bal.toLocaleString()}</strong>
              <span className="opacity-80">$BaseTC</span>
            </div>
            <button
              className="rounded-lg border border-[#30435e] bg-gradient-to-b from-[#0f2432] to-[#0b1722] px-3 py-2 text-[12px] font-semibold"
              onClick={() => setBal((b) => b + Math.floor(2 + Math.random() * 6))}
            >
              Claim
            </button>
          </div>
        </header>

        {/* monitor card */}
        <section className="mt-3 rounded-xl border border-[#202838] bg-gradient-to-b from-[#0f1622] to-[#0c1119] p-2 shadow-[0_12px_32px_rgba(0,0,0,.28),inset_0_1px_0_rgba(255,255,255,.02)]">
          <div className="rounded-lg border border-[#122333] bg-[#041018] p-2">
            {/* quick stats */}
            <div className="no-scrollbar mb-2 flex gap-2 overflow-x-auto">
              <div className="min-w-[150px] rounded-lg border border-[#122a3a] bg-gradient-to-b from-[#07121a] to-[#061018] p-2">
                <div className="text-[11px] text-[#9aacc6]">Pool</div>
                <div className="text-[15px] font-extrabold">stratum+tcp://base:3333</div>
              </div>
              <div className="min-w-[120px] rounded-lg border border-[#122a3a] bg-gradient-to-b from-[#07121a] to-[#061018] p-2">
                <div className="text-[11px] text-[#9aacc6]">Total Hash</div>
                <div className="text-[15px] font-extrabold">{hash}</div>
              </div>
              <div className="min-w-[100px] rounded-lg border border-[#122a3a] bg-gradient-to-b from-[#07121a] to-[#061018] p-2">
                <div className="text-[11px] text-[#9aacc6]">Uptime</div>
                <div className="text-[15px] font-extrabold">{uptime}</div>
              </div>
            </div>

            {/* sparkline + side tiles */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_220px]">
              <div className="rounded-md border border-[#11273a] bg-gradient-to-b from-[#061221] to-[#041018]">
                <Sparkline mining={mining} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-md border border-[#122b3c] bg-gradient-to-b from-[#08141b] to-[#061018] p-2">
                  <div className="text-[12px] font-semibold">Last Share</div>
                  <div className="text-[12px] text-[#9aacc6]">{lastShare}</div>
                </div>
                <div className="rounded-md border border-[#122b3c] bg-gradient-to-b from-[#08141b] to-[#061018] p-2">
                  <div className="text-[12px] font-semibold">Pool</div>
                  <div className="text-[12px] text-[#9aacc6]">connected</div>
                </div>
                <div className="rounded-md border border-[#122b3c] bg-gradient-to-b from-[#08141b] to-[#061018] p-2">
                  <div className="text-[12px] font-semibold">Power</div>
                  <div className="text-[15px] font-extrabold">{power}</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* rig panel */}
        <section className="mt-3 rounded-xl border border-[#182737] bg-gradient-to-b from-[#0f1622] to-[#0b1118] p-3">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <div className="text-[13px] font-semibold">Rig Room</div>
              <div className="text-[11px] text-[#9aacc6]">2 × GPUs • fan auto</div>
            </div>
            <div className="text-[11px] text-[#9aacc6]">Ping {ping} ms</div>
          </div>

          <div className="overflow-hidden rounded-lg border border-[#223146] bg-[#06101a]">
            <img src="/img/basic.png" alt="Rig room" className="w-full" />
          </div>

          <table className="mt-2 w-full border-collapse text-[12px]">
            <thead>
              <tr className="text-left text-[11px] font-semibold">
                <th className="pb-1 pr-2">GPU</th>
                <th className="pb-1 pr-2">Temp</th>
                <th className="pb-1 pr-2">Fan</th>
                <th className="pb-1">Hash</th>
              </tr>
            </thead>
            <tbody className="[&>tr>td]:border-b [&>tr>td]:border-white/5">
              <tr>
                <td className="py-2 pr-2 text-[#9aacc6]">GPU 0</td>
                <td className="py-2 pr-2">{g0t}</td>
                <td className="py-2 pr-2">{g0f}</td>
                <td className="py-2">{g0h}</td>
              </tr>
              <tr>
                <td className="py-2 pr-2 text-[#9aacc6]">GPU 1</td>
                <td className="py-2 pr-2">{g1t}</td>
                <td className="py-2 pr-2">{g1f}</td>
                <td className="py-2">{g1h}</td>
              </tr>
            </tbody>
          </table>

          <div className="mt-2 grid grid-cols-3 gap-2">
            <button
              onClick={() => setMining((m) => !m)}
              className="rounded-lg border border-[#263346] bg-gradient-to-b from-[#111827] to-[#0e1620] px-3 py-2 text-[13px] font-semibold"
            >
              {mining ? "Stop" : "Start"}
            </button>
            <button
              onClick={() => setFanBias((b) => b + 6)}
              className="rounded-lg border border-[#263346] bg-gradient-to-b from-[#111827] to-[#0e1620] px-3 py-2 text-[13px] font-semibold"
            >
              Fan +
            </button>
            <button
              onClick={() => setFanBias((b) => Math.max(-30, b - 6))}
              className="rounded-lg border border-[#263346] bg-gradient-to-b from-[#111827] to-[#0e1620] px-3 py-2 text-[13px] font-semibold"
            >
              Fan −
            </button>
          </div>

          <div className="mt-1 text-[11px] text-[#9aacc6]">Demo UI mobile. Data simulasi.</div>
        </section>
      </div>

      {/* bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-50">
        <div className="mx-auto mb-2 w-full max-w-[430px] px-2">
          <div className="grid grid-cols-4 gap-2 rounded-2xl border border-[#1d3246] bg-gradient-to-b from-[#0b1420] to-[#071018] p-2 shadow-[0_12px_32px_rgba(0,0,0,.28),inset_0_1px_0_rgba(255,255,255,.02)]">
            {["Home", "Workshop", "Market", "Wallet"].map((t, i) => (
              <button
                key={t}
                className={`min-h-[44px] rounded-lg text-[12px] font-semibold ${i === 0 ? "text-white outline outline-2 outline-[#5ad6ff36]" : "text-[#9aacc6]"}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </nav>
    </main>
  );
}

