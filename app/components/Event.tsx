// app/components/Event.tsx
"use client";

import { useState, type FC } from "react";
// Komponen-komponen ini akan kita buat selanjutnya
// import Staking from "./Staking";
// import Spin from "./Spin";
// import Leaderboard from "./Leaderboard";

type EventTab = "staking" | "spin" | "leaderboard";

const Event: FC = () => {
  const [activeTab, setActiveTab] = useState<EventTab>("staking");

  const renderContent = () => {
    switch (activeTab) {
      // case "staking":
      //   return <Staking />;
      // case "spin":
      //   return <Spin />;
      // case "leaderboard":
      //   return <Leaderboard />;
      default:
        return (
          <div className="p-4 text-center text-neutral-400">
            <p>Fitur sedang dalam pengembangan.</p>
          </div>
        );
    }
  };

  return (
    <div className="space-y-4 px-4 pt-4 pb-24">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Events</h1>
        <p className="text-sm text-neutral-400">
          Ikuti event untuk mendapatkan lebih banyak reward.
        </p>
      </header>

      {/* Sub-navigation */}
      <div className="flex items-center justify-center gap-2 rounded-lg bg-neutral-800 p-1">
        {(["staking", "spin", "leaderboard"] as EventTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`w-full rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab
                ? "bg-neutral-700 text-white"
                : "text-neutral-400 hover:bg-neutral-700/50"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Konten dinamis berdasarkan tab yang aktif */}
      <div>{renderContent()}</div>
    </div>
  );
};

export default Event;
