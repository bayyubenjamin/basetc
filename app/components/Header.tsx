"use client";

import Link from "next/link";
import Image from "next/image";
import { FC } from "react";

const Dot = () => <span className="mx-3 text-zinc-500">•</span>;

const TickerContent: FC = () => (
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

const Header: FC = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-zinc-950/80 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/60">
      {/* Top bar: logo + nav */}
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-3 sm:px-4">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/img/logo.png" alt="BaseTC" width={20} height={20} className="rounded" />
            <span className="hidden text-sm font-semibold text-zinc-100 sm:inline">BaseTC Console</span>
          </Link>
        </div>

        <nav className="hidden items-center gap-4 sm:flex">
          <Link href="/launch" className="text-sm text-zinc-300 hover:text-white">Home</Link>
          <Link href="/rakit" className="text-sm text-zinc-300 hover:text-white">Rakit</Link>
          <Link href="/market" className="text-sm text-zinc-300 hover:text-white">Market</Link>
          <Link href="/profil" className="text-sm text-zinc-300 hover:text-white">Profil</Link>
        </nav>

        {/* CTA kanan (opsional) */}
        <div className="flex items-center gap-2">
          <Link href="/launch" className="rounded-md border border-white/10 px-2 py-1 text-xs text-zinc-200 hover:bg-white/5">
            Open App
          </Link>
        </div>
      </div>

      {/* Divider tipis */}
      <div className="h-px w-full bg-white/10" />

      {/* Ticker */}
      <div className="relative h-9 w-full overflow-hidden">
        {/* Fade mask kiri/kanan */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-zinc-950/80 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-zinc-950/80 to-transparent" />
        <div className="ticker group will-change-transform">
          <div className="ticker__track">
            <TickerContent />
            <TickerContent />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;