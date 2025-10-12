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

  // --- helper: upaya maksimal buka di BROWSER SISTEM (keluar dari webview/mini app) ---
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isAndroid = /\bAndroid\b/i.test(ua);
  const isIOS = /\b(iPhone|iPad|iPod)\b/i.test(ua);
  const isWarpcast = /\bWarpcast\b/i.test(ua);

  const openExternal = (url: string) => {
    // 1) iOS: pakai Share Sheet sistem (sering memaksa keluar ke Safari/Chrome dari mini webview)
    if (isIOS && (navigator as any)?.share) {
      try {
        (navigator as any).share({ url, title: "Open in Browser" });
        return;
      } catch {
        // lanjut ke fallback
      }
    }

    // 2) ANDROID: Chrome intent (paling efektif keluar dari webview)
    if (isAndroid) {
      try {
        const u = new URL(url);
        const scheme = u.protocol.replace(":", "");
        const intent =
          `intent://${u.host}${u.pathname}${u.search}${u.hash}` +
          `#Intent;scheme=${scheme};package=com.android.chrome;` +
          `S.browser_fallback_url=${encodeURIComponent(url)};end`;
        // coba via intent
        window.location.href = intent;
        // siapkan fallback jika intent tidak didukung
        setTimeout(() => {
          // alternatif skema chrome spesifik
          const chromeUrl = url.replace(/^https?:\/\//, (m) =>
            m === "https://" ? "googlechrome://" : "googlechrome://"
          );
          window.location.href = chromeUrl;
          // fallback terakhir: tab baru
          setTimeout(() => {
            const win = window.open(url, "_blank", "noopener,noreferrer");
            if (!win) window.location.href = url;
          }, 250);
        }, 350);
        return;
      } catch {
        // fallback umum
      }
    }

    // 3) Umum: coba _blank (kadang menawarkan "Open in Browser")
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (!win) {
      // 4) Fallback terakhir: hard redirect (tetap bisa di webview jika dibatasi)
      window.location.href = url;
    }
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
        style={{ borderRadius: "20px / 12px" }} // sudut oval
      >
        <img
          src="https://ik.imagekit.io/5spt6gb2z/IMG_9023.jpeg"
          alt="Giveaway Banner"
          className="w-full max-w-md rounded-xl shadow-md mb-3"
          style={{ borderRadius: "16px / 10px" }}
        />

        {/* Tombol: upaya maksimal keluar ke browser sistem */}
        <button
          onClick={() => openExternal(GIVEAWAY_URL)}
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg shadow transition-all duration-150"
        >
          SUBMIT GIVEAWAY
        </button>

        {/* Link pendamping untuk long-press → Open in Browser */}
        <a
          href={GIVEAWAY_URL}
          target="_blank"
          rel="external noopener noreferrer"
          className="mt-2 text-xs text-blue-300 underline decoration-dotted"
        >
          (Open in browser)
        </a>

        {/* Tip khusus jika terdeteksi di Warpcast webview */}
        {isWarpcast && (
          <p className="mt-2 text-[11px] text-blue-200/80">
            Jika masih terbuka di dalam mini app, tap tombol ••• lalu pilih <span className="font-semibold">Open in Browser</span>.
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
    </div>
  );
};

export default Event;