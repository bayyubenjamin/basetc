"use client";

export default function Ticker() {
  return (
    <div className="sticky top-0 z-50 w-full overflow-hidden border-b border-white/10 bg-zinc-950/80 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/60">
      <div className="relative h-9 w-full overflow-hidden">
        {/* Fade kiri/kanan */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-zinc-950/80 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-zinc-950/80 to-transparent" />

        <div className="basetc-ticker">
          <div className="basetc-track">
            <Content />
            <Content />
          </div>
        </div>
      </div>
    </div>
  );
}

function Dot() {
  return <span className="mx-3 text-zinc-500">•</span>;
}

function Content() {
  return (
    <div className="flex shrink-0 items-center gap-0 pr-10">
      <span className="font-medium text-zinc-200">$BaseTC&nbsp;Max&nbsp;Supply</span>
      <span className="ml-2 rounded px-2 py-0.5 text-sm font-semibold text-white bg-indigo-600/80">
        21,000,000
      </span>
      <Dot />
      <span className="font-medium text-zinc-200">Mining&nbsp;Rewards</span>
      <span className="ml-2 rounded px-2 py-0.5 text-sm font-semibold text-white bg-sky-600/80">
        85.2% = 17.9M
      </span>
      <Dot />
      <span className="font-medium text-zinc-200">Eco & LP Reserve</span>
      <span className="ml-2 rounded px-2 py-0.5 text-sm font-semibold text-white bg-teal-600/80">
        10% = 2.1M
      </span>
      <Dot />
      <span className="font-medium text-zinc-200">Treasury</span>
      <span className="ml-2 rounded px-2 py-0.5 text-sm font-semibold text-white bg-amber-600/80">
        4.8% = 1M (Satoshi&nbsp;Wallet)
      </span>
      <Dot />
    </div>
  );
}