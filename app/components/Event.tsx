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

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isWarpcast = /\bWarpcast\b/i.test(ua);

  // --- opsi 1: minta OS buka share sheet (sering ada "Open in Safari/Chrome")
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

  // --- opsi 2: copy ke clipboard
  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      alert("Link disalin. Di mini app, tap ••• lalu 'Open in Browser', atau buka dari Safari/Chrome.");
    } catch {
      alert("Gagal menyalin. Tahan lama pada link lalu pilih 'Copy'.");
    }
  };

  // --- opsi 3: _blank fallback (tetap bisa dibuka di webview jika dibatasi)
  const openBlank = (url: string) => {
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (!w) window.location.href = url;
  };

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

      {/* 🎁 Giveaway Banner Section */}
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

        {/* Tombol utama: buka modal kontrol keluar browser */}
        <button
          onClick={() => setShowOpenBrowser(true)}
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg shadow transition-all duration-150"
        >
          SUBMIT GIVEAWAY
        </button>

        {/* Link pendamping untuk long-press */}
        <a
          href={GIVEAWAY_URL}
          target="_blank"
          rel="external noopener noreferrer"
          className="mt-2 text-xs text-blue-300 underline decoration-dotted"
        >
          (Open in browser)
        </a>

        {isWarpcast && (
          <p className="mt-2 text-[11px] text-blue-200/80">
            Jika tetap terbuka di mini app, tap <span className="font-semibold">•••</span> lalu pilih{" "}
            <span className="font-semibold">Open in Browser</span>.
          </p>
        )}
      </div>

      {/* Sub navigation (tabs) */}
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

      {/* Content */}
      <section className="fin-card fin-card-trans fin-card-pad" style={{ margin: "16px" }}>
        {renderContent()}
      </section>

      <div className="fin-bottom-space" />

      {/* === Modal “Buka di Browser” === */}
      {showOpenBrowser && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4"
          onClick={() => setShowOpenBrowser(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-neutral-900 border border-neutral-700 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white mb-2">Buka di Browser</h3>
            <p className="text-sm text-neutral-300 mb-4">
              Sistem mini app kadang memaksa link tetap di dalam aplikasi. Pilih salah satu opsi di bawah agar
              terbuka di Safari/Chrome.
            </p>

            <div className="space-y-2">
              <button
                onClick={() => {
                  shareSystem(GIVEAWAY_URL);
                  setShowOpenBrowser(false);
                }}
                className="w-full rounded-lg px-4 py-2 font-semibold bg-blue-600 hover:bg-blue-700 text-white"
              >
                Share → Open in Safari/Chrome
              </button>

              <button
                onClick={() => copyLink(GIVEAWAY_URL)}
                className="w-full rounded-lg px-4 py-2 font-semibold bg-neutral-800 hover:bg-neutral-700 text-white"
              >
                Copy Link
              </button>

              <button
                onClick={() => {
                  openBlank(GIVEAWAY_URL);
                  setShowOpenBrowser(false);
                }}
                className="w-full rounded-lg px-4 py-2 font-semibold bg-neutral-800 hover:bg-neutral-700 text-white"
              >
                Open in New Tab (fallback)
              </button>
            </div>

            <button
              onClick={() => setShowOpenBrowser(false)}
              className="mt-4 w-full rounded-lg px-4 py-2 font-medium text-neutral-300 hover:text-white"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Event;