// app/components/Event.tsx
"use client";

import { useState, type FC } from "react";
import Staking from "./Staking";
import Spin from "./Spin";
import Leaderboard from "./Leaderboard";

type EventTab = "spin" | "staking" | "leaderboard";
const GIVEAWAY_URL = "https://forms.gle/BuJpf1UDFNGFvPgm8";

const Event: FC = () => {
  const [activeTab, setActiveTab] = useState<EventTab>("spin");
  const [showPopup, setShowPopup] = useState(false);

  const shareSystem = async (url: string) => {
    try {
      if ((navigator as any)?.share) {
        await (navigator as any).share({ url, title: "Open in Browser" });
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

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
      {/* Page Head */}
      <div className="fin-page-head">
        <h1>Events</h1>
        <p>Join special events to earn extra rewards</p>
      </div>

      {/* Giveaway hero card */}
      <div className="mx-4 mb-4 p-4 fin-card neu">
        <div className="flex flex-col items-center text-center">
          <img
            src="https://ik.imagekit.io/5spt6gb2z/IMG_9023.jpeg"
            alt="Giveaway Banner"
            className="w-full max-w-md rounded-xl shadow-md mb-3 neu-inner"
          />

          <button
            onClick={() => setShowPopup(true)}
            className="neu-btn inline-block font-semibold px-6 py-2 rounded-lg transition-all duration-150"
          >
            SUBMIT GIVEAWAY
          </button>
        </div>
      </div>

      {/* Tabs card */}
      <div className="fin-card fin-card-trans fin-card-pad neu mx-4">
        <div className="flex items-center justify-center gap-2">
          {(["spin", "staking", "leaderboard"] as EventTab[]).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 text-sm font-semibold rounded-lg py-2 transition-all duration-150 neu-btn ${
                  isActive ? "ring-1 ring-white/10" : ""
                }`}
                aria-pressed={isActive}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content card */}
      <section className="fin-card fin-card-trans fin-card-pad neu mx-4">
        {renderContent()}
      </section>

      <div className="fin-bottom-space" />

      {/* Popup */}
      {showPopup && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4"
          onClick={() => setShowPopup(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-neutral-900 border border-neutral-700 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white mb-2">Open in your browser</h3>
            <p className="text-sm text-neutral-300 mb-4">
              Please open this form directly in your Safari or Chrome browser for the best experience.
            </p>

            <button
              onClick={() => {
                shareSystem(GIVEAWAY_URL);
                setShowPopup(false);
              }}
              className="w-full rounded-lg px-4 py-2 font-semibold neu-btn"
            >
              Open in Browser
            </button>

            <button
              onClick={() => setShowPopup(false)}
              className="mt-4 w-full rounded-lg px-4 py-2 font-medium text-neutral-300 hover:text-white neu-btn"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Event;

