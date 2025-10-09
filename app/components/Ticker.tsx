"use client";

import { useEffect, useState } from "react";
import TokenomicsLite from "./TokenomicsLite";

export default function Ticker() {
  const [open, setOpen] = useState(false);

  // optional: close on ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <div className="basetc-ticker relative h-9 w-full overflow-hidden border-b border-white/10 bg-zinc-950/70 backdrop-blur">
        {/* left/right fade */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-zinc-950/80 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-zinc-950/80 to-transparent" />

        {/* running track (pakai class kamu persis) */}
        <div className="basetc-track flex items-center">
          <TickerContent />
          <TickerContent />
        </div>

        {/* Info button di kanan (absolute), tidak ganggu track */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-100 hover:bg-white/10"
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          Info
        </button>
      </div>

      {/* Modal */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50"
          onClick={() => setOpen(false)}
        >
          {/* overlay */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* panel (full-screen mobile, centered desktop) */}
          <div
            className="absolute inset-x-0 top-0 mx-0 mt-0 h-[100dvh] overflow-hidden rounded-none border-0 bg-zinc-900 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-[80vh] sm:w-[1024px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <h3 className="text-sm font-semibold text-zinc-100">$BaseTC Tokenomics</h3>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-2 text-zinc-300 hover:text-white hover:bg-white/5"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* scroll area */}
            <div className="h-[calc(100%-48px)] overflow-y-auto px-3 py-3 sm:px-6 sm:py-5 pb-24">
              <TokenomicsLite />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function TickerContent() {
  return (
    <div className="flex shrink-0 items-center gap-0 pr-10">
      <span className="font-medium text-zinc-200">$BaseTC&nbsp;Max&nbsp;Supply</span>
      <span className="ml-2 rounded px-2 py-0.5 text-sm font-semibold text-white bg-indigo-600/80">21,000,000</span>
      <span className="mx-3 text-zinc-500">•</span>
      <span className="font-medium text-zinc-200">Mining&nbsp;Rewards</span>
      <span className="ml-2 rounded px-2 py-0.5 text-sm font-semibold text-white bg-sky-600/80">85.2% = 17.9M</span>
      <span className="mx-3 text-zinc-500">•</span>
      <span className="font-medium text-zinc-200">Liquidity</span>
      <span className="ml-2 rounded px-2 py-0.5 text-sm font-semibold text-white bg-teal-600/80">10% = 2.1M</span>
      <span className="mx-3 text-zinc-500">•</span>
      <span className="font-medium text-zinc-200">Treasury</span>
      <span className="ml-2 rounded px-2 py-0.5 text-sm font-semibold text-white bg-amber-600/80">
        4.8% (Satoshi&nbsp;Wallet)
      </span>
      <span className="mx-3 text-zinc-500">•</span>
    </div>
  );
}