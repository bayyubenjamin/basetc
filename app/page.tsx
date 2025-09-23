// app/page.tsx
"use client";
import { useState, useEffect } from "react";
import Navigation, { TabName } from "./components/Navigation";
import Monitoring from "./components/Monitoring";
import Rakit from "./components/Rakit";
import Market from "./components/Market";
import Profil from "./components/Profil";
import { sdk } from "@farcaster/miniapp-sdk";

export default function Page() {
  const [activeTab, setActiveTab] = useState<TabName>("monitoring");

  // Panggil ready() setelah aplikasi mount
  useEffect(() => {
    sdk.actions.ready();
  }, []);

  return (
    <div className="flex flex-col min-h-screen pb-16">
      {/* Header */}
      <header className="p-4 bg-neutral-800 border-b border-neutral-700">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">BaseTC Mining Console</h1>
            <p className="text-sm text-muted">Farcaster Mini App</p>
          </div>
          <div className="flex space-x-4 items-center">
            <div className="text-right">
              <p className="text-muted text-xs">Hash</p>
              <p className="text-lg font-bold">1.23&nbsp;GH/s</p>
            </div>
            <button className="bg-emerald-600 px-3 py-2 rounded-md text-sm hover:bg-emerald-700">
              Start
            </button>
            <button className="bg-red-600 px-3 py-2 rounded-md text-sm hover:bg-red-700">
              Stop
            </button>
          </div>
        </div>
      </header>

      {/* Konten */}
      <main className="flex-1 overflow-y-auto">
        {activeTab === "monitoring" && <Monitoring />}
        {activeTab === "rakit" && <Rakit />}
        {activeTab === "market" && <Market />}
        {activeTab === "profil" && <Profil />}
      </main>

      {/* Navigasi bawah */}
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}

