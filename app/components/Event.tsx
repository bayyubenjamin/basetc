// app/components/Event.tsx
"use client";

import { useState, type FC } from "react";
import Staking from "./Staking";
import Spin from "./Spin";
import Leaderboard from "./Leaderboard";

type EventTab = "spin" | "staking" | "leaderboard";

const Event: FC = () => {
  const [activeTab, setActiveTab] = useState<EventTab>("spin");

  // --- helper: paksa buka di browser sistem, bukan webview mini app ---
  const isAndroid = () => /Android/i.test(navigator.userAgent);
  const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);

  const openExternal = (rawUrl: string) => {
    const url = rawUrl.trim();

    try {
      if (isAndroid()) {
        // Chrome Intent (keluar dari webview → buka Chrome). Ada fallback ke https biasa.
        const u = new URL(url);
        const intent = `intent://${u.host}${u.pathname}${u.search}${u.hash}#Intent;scheme=${u.protocol.replace(
          ":",
          ""
        )};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(
          url
        )};end`;
        window.location.href = intent;
        return;
      }

      if (isIOS()) {
        // Coba buka Chrome (jika terpasang). Jika gagal dalam 600ms → fallback _blank.
        const chromeURL = url.replace(/^https?:\/\//, (m) =>
          m === "https://" ? "googlechromes://" : "googlechrome://"
        );

        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.src = chromeURL;
        document.body.appendChild(iframe);

        const timer = setTimeout(() => {
          // fallback: tetap coba buka tab baru (user bisa tap ... → Open in Safari)
          window.open(url, "_blank", "noopener,noreferrer");
          document.body.removeChild(iframe);
        }, 600);

        // safety cleanup jika berhasil (tidak ada cara pasti, jadi tetap cleanup setelah 1500ms)
        setTimeout(() => {
          clearTimeout(timer);
          try {
            document.body.removeChild(iframe);
          } catch {}
        }, 1500);

        return;
      }

      // Desktop / lainnya: buka tab baru normal
      const win = window.open(url, "_blank", "noopener,noreferrer");
      if (!win) window.location.href = url; // fallback jika popup diblokir
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
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
        style={{
          borderRadius: "20px / 12px", // oval-like corners
        }}
      >
        <img
          src="https://ik.imagekit.io/5spt6gb2z/IMG_9023.jpeg"
          alt="Giveaway Banner"
          className="w-full max-w-md rounded-xl shadow-md mb-3"
          style={{ borderRadius: "16px / 10px" }}
        />

        {/* Tombol: paksa buka eksternal */}
        <button
          onClick={() => openExternal("https://forms.gle/BuJpf1UDFNGFvPgm8")}
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg shadow transition-all duration-150"
        >
          SUBMIT GIVEAWAY
        </button>

        {/* Anchor dukungan (tap & tahan → “Open in Browser”) */}
        <a
          href="https://forms.gle/BuJpf1UDFNGFvPgm8"
          target="_blank"
          rel="external noopener noreferrer"
          className="mt-2 text-xs text-blue-300 underline decoration-dotted"
        >
          (Open in browser)
        </a>
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