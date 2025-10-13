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
  const [showOpenBrowser, setShowOpenBrowser] = useState(false);

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

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      alert("Link copied. Open your Safari/Chrome and paste it.");
    } catch {
      alert("Copy failed. Long-press the link and choose Copy.");
    }
  };

  const openBlank = (url: string) => {
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (!w) window.location.href = url;
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
      <div className="fin-page-head">
        <h1>Events</h1>
        <p>Join special events to earn extra rewards</p>
      </div>

      <div
        className="flex flex-col items-center justify-center text-center mx-4 mb-4 p-4 bg-gradient-to-br from-blue-900/40 to-purple-800/30 border border-blue-500/30 shadow-lg"
        style={{ borderRadius: "20px / 12px" }}
      >
        <img
          src="https://ik.imagekit.io/5spt6gb2z/IMG_9023.jpeg"
          alt="Giveaway Banner"
          className="w-full max-w-md rounded-xl shadow-md mb-3"
          style={{ borderRadius: "16px / 10px" }}
        />

        <button
          onClick={() => setShowOpenBrowser(true)}
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg shadow transition-all duration-150"
        >
          SUBMIT GIVEAWAY!
        </button>
      </div>

      <div className="fin-card fin-card-trans fin-card-pad" style={{ margin: "16px" }}>
        <div className="flex items-center justify-center gap-2">
          {(["spin", "staking", "leaderboard"] as EventTab[]).map((tab) => (
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

      <section className="fin-card fin-card-trans fin-card-pad" style={{ margin: "16px" }}>
        {renderContent()}
      </section>

      <div className="fin-bottom-space" />

      {showOpenBrowser && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4"
          onClick={() => setShowOpenBrowser(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-neutral-900 border border-neutral-700 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white mb-2">Open in your browser</h3>
            <p className="text-sm text-neutral-300 mb-4">
              Mini app browsers may keep links inside the app. Please choose one option below to open the form in Safari/Chrome.
            </p>

            <div className="space-y-2">
              <button
                onClick={() => {
                  shareSystem(GIVEAWAY_URL);
                  setShowOpenBrowser(false);
                }}
                className="w-full rounded-lg px-4 py-2 font-semibold bg-blue-600 hover:bg-blue-700 text-white"
              >
                Share → Open in Browser
              </button>

              <button
                onClick={() => copyLink(GIVEAWAY_URL)}
                className="w-full rounded-lg px-4 py-2 font-semibold bg-neutral-800 hover:bg-neutral-700 text-white"
              >
                Copy link
              </button>

              <button
                onClick={() => {
                  openBlank(GIVEAWAY_URL);
                  setShowOpenBrowser(false);
                }}
                className="w-full rounded-lg px-4 py-2 font-semibold bg-neutral-800 hover:bg-neutral-700 text-white"
              >
                Open in new tab (fallback)
              </button>
            </div>

            <button
              onClick={() => setShowOpenBrowser(false)}
              className="mt-4 w-full rounded-lg px-4 py-2 font-medium text-neutral-300 hover:text-white"
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