"use client";
import { useState } from "react";
import Navigation, { TabName } from "./components/Navigation";
import Monitoring from "./components/Monitoring";
import Rakit from "./components/Rakit";
import Market from "./components/Market";
import Profil from "./components/Profil";

export default function Page() {
  const [activeTab, setActiveTab] = useState<TabName>("monitoring");

  return (
    <main className="app no-scrollbar">
      {/* Header / Top Bar */}
      <header className="top">
        <div className="brand">
          <div className="logo" />
          <div>
            <div className="title">BaseTC Mining Console</div>
            <div className="sub">Farcaster Mini App</div>
          </div>
        </div>
        <div className="right">
          <div className="pill"><span>Hash</span><strong>1.23 GH/s</strong></div>
          <button className="btn primary">Start</button>
          <button className="btn">Stop</button>
        </div>
      </header>

      {/* Konten */}
      {activeTab === "monitoring" && <Monitoring />}
      {activeTab === "rakit" && <Rakit />}
      {activeTab === "market" && <Market />}
      {activeTab === "profil" && <Profil />}

      {/* Bottom Nav */}
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
    </main>
  );
}

