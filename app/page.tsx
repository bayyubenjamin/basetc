"use client";

import { useEffect, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import Navigation, { TabName } from "./components/Navigation";
import Monitoring from "./components/Monitoring";
import Rakit from "./components/Rakit";
import Market from "./components/Market";
import Profil from "./components/Profil";

export default function Page() {
  const [activeTab, setActiveTab] = useState<TabName>("monitoring");

  useEffect(() => {
    sdk.actions.ready();
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-neutral-900 text-white">
      {/* Header — dibuat jauh lebih compact */}
      <header className="sticky top-0 z-20 w-full border-b border-neutral-800 bg-neutral-900/80 backdrop-blur supports-[backdrop-filter]:bg-neutral-900/60">
        <div className="mx-auto w-full max-w-[430px] px-3 py-2.5">
          <div className="grid grid-cols-[1fr_auto] items-center gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-md border border-neutral-700 bg-neutral-800" />
                <h1 className="truncate text-base font-semibold leading-tight">
                  BaseTC Mining Console
                </h1>
              </div>
              <p className="mt-0.5 text-[11px] leading-none text-neutral-400">
                Farcaster Mini App
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-[10px] leading-none text-neutral-400">Hash</p>
                <p className="text-sm font-semibold leading-none">1.23 GH/s</p>
              </div>
              <button
                className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold leading-none hover:bg-emerald-700"
                type="button"
              >
                Start
              </button>
              <button
                className="rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-semibold leading-none hover:bg-red-700"
                type="button"
              >
                Stop
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Konten */}
      <main className="mx-auto w-full max-w-[430px] flex-1 px-3 pb-[64px] pt-3">
        {activeTab === "monitoring" && <Monitoring />}
        {activeTab === "rakit" && <Rakit />}
        {activeTab === "market" && <Market />}
        {activeTab === "profil" && <Profil />}
      </main>

      {/* Bottom nav (komponen terpisah) */}
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}

