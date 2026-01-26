"use client";

import Link from "next/link";
import Image from "next/image";
import BasenameBadge from "./BasenameBadge";

const Dot = () => <span className="mx-3 text-zinc-500">•</span>;

function TickerContent() {
  return (
    <div className="flex shrink-0 items-center gap-0 pr-10">
      <span className="font-medium text-zinc-200">$BaseTC&nbsp;Max&nbsp;Supply</span>
      <span className="ml-2 rounded px-2 py-0.5 text-sm font-semibold text-white bg-indigo-600/80">21,000,000</span>
      <Dot />
      <span className="font-medium text-zinc-200">Mining&nbsp;Rewards</span>
      <span className="ml-2 rounded px-2 py-0.5 text-sm font-semibold text-white bg-sky-600/80">85.2% = 17.9M</span>
      <Dot />
      <span className="font-medium text-zinc-200">Liquidity</span>
      <span className="ml-2 rounded px-2 py-0.5 text-sm font-semibold text-white bg-teal-600/80">10% = 2.1M</span>
      <Dot />
      <span className="font-medium text-zinc-200">Treasury</span>
      <span className="ml-2 rounded px-2 py-0.5 text-sm font-semibold text-white bg-amber-600/80">
        4.8% (Satoshi&nbsp;Wallet)
      </span>
      <Dot />
    </div>
  );
}

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-zinc-950/80 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-3 sm:px-4">
        {/* Left: Logo & Brand */}
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <Image src="/img/logo.png" alt="BaseTC" width={24} height={24} className="rounded-md" />
            <span className="hidden text-sm font-bold tracking-tight text-zinc-100 sm:inline">BaseTC Console</span>
          </Link>
        </div>

        {/* Center: Navigation Links */}
        <nav className="hidden items-center gap-6 sm:flex">
          <Link href="/launch" className="text-sm font-medium text-zinc-400 transition-colors hover:text-white">Home</Link>
          <Link href="/rakit" className="text-sm font-medium text-zinc-400 transition-colors hover:text-white">Rakit</Link>
          <Link href="/market" className="text-sm font-medium text-zinc-400 transition-colors hover:text-white">Market</Link>
          <Link href="/profil" className="text-sm font-medium text-zinc-400 transition-colors hover:text-white">Profil</Link>
        </nav>

        {/* Right: Actions & Identity */}
        <div className="flex items-center gap-3">
          {/* [NEW] Basename Badge Integration */}
          <BasenameBadge />

          <Link 
            href="/launch" 
            className="hidden sm:block rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-all hover:bg-white/10 hover:border-white/20 active:scale-95"
          >
            Open App
          </Link>
        </div>
      </div>

      <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* Ticker Section */}
      <div className="relative h-9 w-full overflow-hidden bg-black/20">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-10 z-10 bg-gradient-to-r from-zinc-950/80 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 z-10 bg-gradient-to-l from-zinc-950/80 to-transparent" />
        <div className="ticker group will-change-transform flex items-center h-full">
          <div className="ticker__track animate-marquee flex items-center">
            <TickerContent />
            <TickerContent />
          </div>
        </div>
      </div>
    </header>
  );
}
