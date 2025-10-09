"use client";

import { useEffect, useRef, useState } from "react";
import Tokenomics from "@/app/components/Tokenomics";

export default function Ticker() {
  const [open, setOpen] = useState(false);
  const railRef = useRef<HTMLDivElement | null>(null);

  // simple auto-scroll (kalau kamu sudah punya scroller sendiri, hapus ini)
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    let x = 0;
    let raf = 0;
    const tick = () => {
      x -= 0.5;
      rail.style.transform = `translateX(${x}px)`;
      if (Math.abs(x) > rail.scrollWidth / 2) x = 0;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      {/* Ticker bar */}
      <div className="w-full sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-zinc-900/50 bg-zinc-900/80 border-b border-white/5">
        <div className="mx-auto max-w-6xl px-4 py-2 flex items-center justify-between gap-3">
          {/* Left: running text / badges */}
          <div className="relative overflow-hidden flex-1 min-w-0">
            <div className="flex items-center gap-6 will-change-transform" ref={railRef}>
              <Badge label="$BaseTC Max Supply" value="21,000,000" />
              <Dot />
              <span className="text-sm text-zinc-300/90 whitespace-nowrap">
                30-day halving • deflationary sinks • LP stabilized
              </span>
              <Dot />
              <span className="text-sm text-zinc-300/90 whitespace-nowrap">
                Mining Rewards 85.2% • Eco & Liquidity 10% • Treasury 4.8%
              </span>
            </div>
          </div>

          {/* Right: Read button */}
          <div className="shrink-0">
            <button
              onClick={() => setOpen(true)}
              className="group inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-zinc-100 hover:bg-white/10 hover:border-white/20 transition"
              aria-haspopup="dialog"
              aria-expanded={open}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" className="opacity-80 group-hover:opacity-100">
                <path fill="currentColor" d="M6 4h9a3 3 0 0 1 3 3v11H9a3 3 0 0 1-3-3z"/>
                <path fill="currentColor" d="M6 4a3 3 0 0 0-3 3v11c0 1.657 1.343 3 3 3h12v-2H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h11V4z"/>
              </svg>
              <span className="hidden sm:inline">Read</span>
              <span className="sm:hidden">Info</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal (no library) */}
      <Modal open={open} onClose={() => setOpen(false)} title="$BaseTC Tokenomics">
        {/* scroll area biar nyaman dibaca */}
        <div className="max-h-[80vh] overflow-y-auto pr-1">
          {/* kamu bisa wrap Tokenomics dalam container gelap biar konsisten */}
          <div className="rounded-xl border border-white/5 bg-[#0b0d12]">
            <Tokenomics />
          </div>
        </div>
      </Modal>
    </>
  );
}

function Badge({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600/80 to-indigo-500/80 px-2.5 py-1 text-xs text-white shadow ring-1 ring-white/10">
      <span className="font-medium">{label}</span>
      <span className="rounded bg-white/15 px-2 py-0.5 text-[11px] font-semibold">{value}</span>
    </span>
  );
}

function Dot() {
  return <span className="mx-3 text-zinc-500">•</span>;
}

/** Simple accessible modal (ESC/overlay close) */
function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  // esc close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center"
      onClick={onClose}
    >
      {/* overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      {/* panel */}
      <div
        className="relative mx-3 mt-16 sm:mt-0 w-full max-w-5xl rounded-2xl border border-white/10 bg-zinc-900/90 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
          <h3 className="text-base font-semibold text-zinc-100">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-md p-2 text-zinc-300 hover:text-white hover:bg-white/5 transition"
            aria-label="Close"
            title="Close"
          >
            ✕
          </button>
        </div>
        <div className="p-4 sm:p-6">{children}</div>
      </div>
    </div>
  );
}