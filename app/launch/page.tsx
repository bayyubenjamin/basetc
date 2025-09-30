// app/launch/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useAccount } from "wagmi";
import { Providers } from "../Providers"; // Provider Wagmi utama (sudah benar)
import { FarcasterProvider, useFarcaster } from "../context/FarcasterProvider";
import Navigation, { type TabName } from "../components/Navigation";
import Monitoring from "../components/Monitoring";
import Rakit from "../components/Rakit";
import Market from "../components/Market";
import Profil from "../components/Profil";
import FidInput from "../components/FidInput";

const DEFAULT_TAB: TabName = "monitoring";
const TAB_KEY = "basetc_active_tab";

function MainApp() {
  const [activeTab, setActiveTab] = useState<TabName>(DEFAULT_TAB);
  const { address } = useAccount();

  // Inisialisasi tab dari ?tab=... atau localStorage
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const q = (url.searchParams.get("tab") || "").toLowerCase();
      const validTabs: TabName[] = ["monitoring", "rakit", "market", "profil"];
      const fromQuery = validTabs.includes(q as TabName) ? (q as TabName) : null;
      const fromStorage = localStorage.getItem(TAB_KEY) as TabName;
      const initial =
        fromQuery || (validTabs.includes(fromStorage) ? fromStorage : DEFAULT_TAB);
      setActiveTab(initial);
    } catch {
      setActiveTab(DEFAULT_TAB);
    }
  }, []);

  // Simpan tab aktif & reset scroll
  useEffect(() => {
    localStorage.setItem(TAB_KEY, activeTab);
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [activeTab]);

  // Upsert mapping wallet <-> fid (jika ada)
  useEffect(() => {
    const fidStr = localStorage.getItem("basetc_fid");
    if (!address || !fidStr) return;
    fetch("/api/user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fid: Number(fidStr), wallet: address }),
    }).catch((err) => console.error("Wallet mapping upsert failed:", err));
  }, [address]);

  const content = useMemo(() => {
    switch (activeTab) {
      case "rakit":
        return <Rakit />;
      case "market":
        return <Market />;
      case "profil":
        return <Profil />;
      default:
        return <Monitoring />;
    }
  }, [activeTab]);

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 pb-24">{content}</main>
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}

function AppInitializer() {
  const { user, ready } = useFarcaster();
  const [resolvedFid, setResolvedFid] = useState<number | null>(null);

  useEffect(() => {
    if (!ready) return;

    let finalFid: number | null = null;

    // 1) Coba ambil dari context Farcaster
    if (user?.fid) {
      finalFid = user.fid;
      // Upsert profil user dari context
      fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fid: user.fid,
          username: user.username,
          display_name: user.displayName,
          pfp_url: user.pfpUrl,
        }),
      }).catch((err) => console.error("Context user auto-upsert failed:", err));
    } else {
      // 2) Fallback: query ?fid= atau localStorage
      try {
        const url = new URL(window.location.href);
        const qfid = url.searchParams.get("fid") || localStorage.getItem("basetc_fid");
        if (qfid && /^\d+$/.test(qfid)) finalFid = Number(qfid);
      } catch {}
    }

    // Simpan FID & deteksi referral (?ref=0x...)
    if (finalFid) {
      localStorage.setItem("basetc_fid", String(finalFid));
      setResolvedFid(finalFid);

      try {
        const url = new URL(window.location.href);
        const ref = url.searchParams.get("ref");
        if (ref && /^0x[0-9a-fA-F]{40}$/.test(ref)) {
          localStorage.setItem("basetc_ref", ref);
          fetch("/api/referral", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "touch", inviter: ref, invitee_fid: finalFid }),
          }).catch((err) => console.error("Referral touch failed:", err));
        }
      } catch {}
    }
  }, [ready, user]);

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-950">
        <p className="text-neutral-400 animate-pulse">Initializing BaseTC...</p>
      </div>
    );
  }

  if (resolvedFid) {
    return <MainApp />;
  }

  return (
    <FidInput
      setFid={(fid) => {
        localStorage.setItem("basetc_fid", String(fid));
        setResolvedFid(fid);
      }}
    />
  );
}

// Halaman utama untuk /launch
export default function Page() {
  // Meta embed untuk Farcaster feed: bikin tombol Open yang meluncurkan mini-app
  const miniappMeta = {
    version: "1",
    imageUrl: "https://basetc.vercel.app/img/logo.png", // pastikan rasio 3:2 (mis. 1200x800)
    button: {
      title: "Open BaseTC",
      action: {
        type: "launch_miniapp", // atau "launch_frame"
        name: "BaseTC Mini App",
        url: "https://basetc.vercel.app/launch",
        splashImageUrl: "https://basetc.vercel.app/img/splash.gif", // 200x200, URL pendek
        splashBackgroundColor: "#0b0b0b",
      },
    },
  };

  return (
    <>
      <Head>
        <meta name="fc:miniapp" content={JSON.stringify(miniappMeta)} />
        {/* (opsional) backward-compat: duplikasi ke fc:frame */}
        {/* <meta name="fc:frame" content={JSON.stringify(miniappMeta)} /> */}
        <title>BaseTC — Launch</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <Providers>
        <FarcasterProvider>
          <AppInitializer />
        </FarcasterProvider>
      </Providers>
    </>
  );
}

