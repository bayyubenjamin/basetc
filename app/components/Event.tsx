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

  // ==== BUKA DI BROWSER SISTEM (upaya maksimal lintas device/webview) ====
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isAndroid = /\bAndroid\b/i.test(ua);
  const isIOS = /\b(iPhone|iPad|iPod)\b/i.test(ua);
  const isWarpcast = /\bWarpcast\b/i.test(ua);

  const openExternal = (url: string) => {
    const targetUrl = url.trim();

    // 0) buat <a> programatik (banyak webview cuma izinkan aksi user→click)
    const a = document.createElement("a");
    a.href = targetUrl;
    a.target = "_blank";
    a.rel = "external noopener noreferrer";
    a.style.display = "none";
    document.body.appendChild(a);

    // 1) ANDROID: intent ke Chrome (paling efektif keluar dari webview)
    if (isAndroid) {
      try {
        const u = new URL(targetUrl);
        const scheme = u.protocol.replace(":", "");
        const intent =
          `intent://${u.host}${u.pathname}${u.search}${u.hash}` +
          `#Intent;scheme=${scheme};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(
            targetUrl
          )};end`;
        // coba lewat intent
        window.location.href = intent;

        // fallback berurutan bila intent ditolak
        setTimeout(() => {
          // skema khusus chrome
          const chromeUrl = targetUrl.replace(/^https?:\/\//, (m) =>
            m === "https://" ? "googlechrome://" : "googlechrome://"
          );
          window.location.href = chromeUrl;

          // fallback: trigger click <a target=_blank>
          setTimeout(() => {
            a.click();

            // fallback terakhir: hard redirect (mungkin tetap di webview)
            setTimeout(() => {
              window.location.href = targetUrl;
              document.body.removeChild(a);
            }, 200);
          }, 200);
        }, 250);
        return;
      } catch {
        // lanjut ke umum
      }
    }

    // 2) iOS: coba share sheet (sering menawarkan buka di Safari)
    if (isIOS && (navigator as any)?.share) {
      (navigator as any)
        .share({ url: targetUrl, title: "Open in Browser" })
        .catch(() => {
          // fallback: klik anchor lalu open _blank
          a.click();
          setTimeout(() => {
            window.open(targetUrl, "_blank", "noopener,noreferrer");
            setTimeout(() => {
              // fallback terakhir: hard redirect
              window.location.href = targetUrl;
              document.body.removeChild(a);
            }, 200);
          }, 50);
        });
      return;
    }

    // 3) Umum/desktop: klik anchor → window.open → hard redirect
    a.click();
    setTimeout(() => {
      const w = window.open(targetUrl, "_blank", "noopener,noreferrer");
      if (!w) {
        window.location.href = targetUrl;
      }
      document.body.removeChild(a);
    }, 50);
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

        {/* Tip UI khusus Warpcast (agar user bisa paksa keluar manual jika webview memblokir) */}
        {isWarpcast && (
          <p className="mt-2 text-[11px] text-blue-200/80">
            Jika masih terbuka di mini app, tap <span className="font-semibold">•••</span> lalu pilih{" "}
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
    </div>
  );
};

export default Event;