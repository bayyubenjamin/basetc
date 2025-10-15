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

  // style helper biar hanya aktif yang biru
  const tabStyle = (isActive: boolean): React.CSSProperties =>
    isActive
      ? {
          background: "linear-gradient(145deg, var(--accent), #1a54d9)",
          color: "#fff",
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow:
            "3px 3px 6px rgba(0,0,0,0.20), inset 0 0 0 1px rgba(255,255,255,0.08)",
        }
      : {
          background: "linear-gradient(145deg, #ffffff, #eaf1ff)",
          color: "var(--muted)",
          border: "1px solid rgba(0,0,0,0.06)",
          boxShadow:
            "2px 2px 6px rgba(0,0,0,0.12), inset 0 0 0 1px rgba(255,255,255,0.45)",
        };

  return (
    <div className="fin-wrap fin-content-pad-bottom">
      {/* Page Head */}
      <div className="fin-page-head">
        <h1 className="text-[22px] font-bold" style={{ color: "var(--text)" }}>
          Events
        </h1>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Join special events to earn extra rewards
        </p>
      </div>

      {/* Giveaway hero card */}
      <div
        className="mx-4 mb-4 p-4 fin-card neu"
        style={{
          background: "rgba(255,255,255,0.85)",
          border: "1px solid rgba(0,0,0,0.06)",
          color: "var(--text)",
        }}
      >
        <div className="flex flex-col items-center text-center">
          <img
            src="https://ik.imagekit.io/5spt6gb2z/IMG_9023.jpeg"
            alt="Giveaway Banner"
            className="w-full max-w-md rounded-xl mb-3"
            style={{
              boxShadow:
                "0 10px 24px rgba(0,0,0,0.18), inset 0 0 0 1px rgba(255,255,255,0.35)",
            }}
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
      <div
        className="fin-card fin-card-trans fin-card-pad neu mx-4"
        style={{
          background: "rgba(255,255,255,0.85)",
          border: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <div className="flex items-center justify-center gap-2">
          {(["spin", "staking", "leaderboard"] as EventTab[]).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="flex-1 text-sm font-semibold rounded-lg py-2 transition-all duration-150"
                style={tabStyle(isActive)}
                aria-pressed={isActive}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content card */}
      <section
        className="fin-card fin-card-trans fin-card-pad neu mx-4"
        style={{
          background: "rgba(255,255,255,0.85)",
          border: "1px solid rgba(0,0,0,0.06)",
          color: "var(--text)",
        }}
      >
        {renderContent()}
      </section>

      <div className="fin-bottom-space" />

      {/* Popup */}
      {showPopup && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
          onClick={() => setShowPopup(false)}
          style={{
            background: "rgba(0,0,0,.45)",
            backdropFilter: "blur(2px)",
            WebkitBackdropFilter: "blur(2px)",
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "rgba(255,255,255,0.9)",
              border: "1px solid rgba(0,0,0,0.06)",
              color: "var(--text)",
            }}
          >
            <h3 className="text-lg font-semibold mb-2">Open in your browser</h3>
            <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
              Please open this form directly in your Safari or Chrome browser
              for the best experience.
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
              className="mt-3 w-full rounded-lg px-4 py-2 font-semibold"
              style={{
                background:
                  "linear-gradient(145deg, #ffffff, #eaf1ff)",
                color: "var(--text)",
                border: "1px solid rgba(0,0,0,0.06)",
                boxShadow:
                  "2px 2px 6px rgba(0,0,0,0.12), inset 0 0 0 1px rgba(255,255,255,0.45)",
              }}
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