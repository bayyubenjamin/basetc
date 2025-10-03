// app/launch/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { Providers } from "../Providers"; // <-- Provider Wagmi utama
import { FarcasterProvider, useFarcaster } from "../context/FarcasterProvider";
import Navigation, { type TabName } from "../components/Navigation";
import Monitoring from "../components/Monitoring";
import Rakit from "../components/Rakit";
import Market from "../components/Market";
import Profil from "../components/Profil";
import Event from "../components/Event"; // <-- Impor komponen baru
import FidInput from "../components/FidInput";

const DEFAULT_TAB: TabName = "monitoring";
const TAB_KEY = "basetc_active_tab";

function MainApp() {
  const [activeTab, setActiveTab] = useState<TabName>(DEFAULT_TAB);
  const { address } = useAccount();

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const q = (url.searchParams.get("tab") || "").toLowerCase();
      const validTabs: TabName[] = ["monitoring", "rakit", "market", "profil", "event"]; // <-- Tambahkan 'event'
      const fromQuery = validTabs.includes(q as TabName) ? (q as TabName) : null;
      const fromStorage = localStorage.getItem(TAB_KEY) as TabName;
      const initial = fromQuery || (validTabs.includes(fromStorage) ? fromStorage : DEFAULT_TAB);
      setActiveTab(initial);
    } catch {
      setActiveTab(DEFAULT_TAB);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(TAB_KEY, activeTab);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [activeTab]);

  useEffect(() => {
    const fidStr = localStorage.getItem("basetc_fid");
    if (!address || !fidStr) return;
    fetch("/api/user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fid: Number(fidStr), wallet: address }),
    }).catch(err => console.error("Wallet mapping upsert failed:", err));
  }, [address]);

  const content = useMemo(() => {
    switch (activeTab) {
      case "rakit": return <Rakit />;
      case "market": return <Market />;
      case "profil": return <Profil />;
      case "event": return <Event />; // <-- Render komponen Event
      default: return <Monitoring />;
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
    if (user?.fid) {
      finalFid = user.fid;
      fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fid: user.fid,
          username: user.username,
          display_name: user.displayName,
          pfp_url: user.pfpUrl,
        }),
      }).catch(err => console.error("Context user auto-upsert failed:", err));
    } else {
      try {
        const url = new URL(window.location.href);
        const qfid = url.searchParams.get("fid") || localStorage.getItem("basetc_fid");
        if (qfid && /^\d+$/.test(qfid)) finalFid = Number(qfid);
      } catch {}
    }

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
          }).catch(err => console.error("Referral touch failed:", err));
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
  
  return <FidInput setFid={(fid) => {
    localStorage.setItem("basetc_fid", String(fid));
    setResolvedFid(fid);
  }} />;
}

// Komponen utama yang akan di-render untuk /dashboard
export default function Page() {
  return (
    <Providers>
      <FarcasterProvider>
        <AppInitializer />
      </FarcasterProvider>
    </Providers>
  );
}
