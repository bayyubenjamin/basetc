// app/components/Event.tsx
"use client";

import { useState, type FC } from "react";
import Staking from "./Staking";
import Spin from "./Spin";
import Leaderboard from "./Leaderboard";

type EventTab = "staking" | "spin" | "leaderboard";

const Event: FC = () => {
  const [activeTab, setActiveTab] = useState<EventTab>("staking");

  // render dynamic content
  const renderContent = () => {
    switch (activeTab) {
      case "spin":
        return <Spin />;
      case "staking":
        return <Staking />;
      case "leaderboard":
        return <Leaderboard />;
      default:
        return null;
    }
  };

  return (
    <div className="fin-wrap fin-content-pad-bottom">
      {/* Header */}
      <div className="fin-page-head">
        <h1>Events</h1>
        <p>Join special events to earn extra rewards</p>
      </div>

      {/* Sub navigation (tabs) */}
      <div className="fin-card fin-card-trans fin-card-pad" style={{ margin: "16px" }}>
        <div className="flex items-center justify-center gap-2">
          {(["staking", "spin", "leaderboard"] as EventTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 text-sm font-semibold rounded-lg py-2 transition-all duration-150 ${
                activeTab === tab
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-transparent text-neutral-400 hover:bg-blue-600/20"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <section className="fin-card fin-card-trans fin-card-pad" style={{ margin: "16px" }}>
        {renderContent()}
      </section>

      <div className="fin-bottom-space" />
    </div>
  );
};

export default Event;
