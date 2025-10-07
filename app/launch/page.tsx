// app/launch/page.tsx
"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useAccount } from "wagmi";
import { Providers } from "../Providers";
import { FarcasterProvider, useFarcaster } from "../context/FarcasterProvider";
import Navigation, { type TabName } from "../components/Navigation";
import Monitoring from "../components/Monitoring";
import Rakit from "../components/Rakit";
import Market from "../components/Market";
import Profil from "../components/Profil";
import Event from "../components/Event";
import FidInput from "../components/FidInput";
import { isAddress } from "ethers";

const DEFAULT_TAB: TabName = "monitoring";
const TAB_KEY = "basetc_active_tab";
const FID_REF_KEY = "basetc_fid_ref";
const FID_KEY = "basetc_fid";

// ---- helper: cari fidref dari URL, referrer, lalu sessionStorage
function getFidRefFallback(): string | undefined {
  try {
    const url = new URL(window.location.href);
    const f1 = url.searchParams.get("fidref");
    if (f1 && /^\d+$/.test(f1)) return f1;
  } catch {}
  try {
    if (document.referrer) {
      const ru = new URL(document.referrer);
      const f2 = ru.searchParams.get("fidref");
      if (f2 && /^\d+$/.test(f2)) return f2;
    }
  } catch {}
  const f3 = sessionStorage.getItem(FID_REF_KEY);
  if (f3 && /^\d+$/.test(f3)) return f3;
  return undefined;
}

function MainApp() {
  const [activeTab, setActiveTab] = useState<TabName>(DEFAULT_TAB);
  const { address } = useAccount();

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const q = (url.searchParams.get("tab") || "").toLowerCase();
      const validTabs: TabName[] = ["monitoring", "rakit", "market", "profil", "event"];
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

  // Kirim wallet user beserta fid_ref saat wallet terdeteksi
  useEffect(() => {
    const fidStr = localStorage.getItem(FID_KEY);
    if (!address || !fidStr) return;
    const fid_ref = getFidRefFallback();
    fetch("/api/user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fid: Number(fidStr), wallet: address, fid_ref }),
    }).catch((err) => console.error("Wallet mapping upsert failed:", err));
  }, [address]);

  const content = useMemo(() => {
    switch (activeTab) {
      case "rakit": return <Rakit />;
      case "market": return <Market />;
      case "profil": return <Profil />;
      case "event": return <Event />;
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

  // simpan fidref secepat mungkin saat mount (agar tersedia untuk call awal)
  useEffect(() => {
    const f = getFidRefFallback();
    if (f) sessionStorage.setItem(FID_REF_KEY, f);
  }, []);

  // tambahan: ambil fidref dari context embed jika diluncurkan dari cast
  useEffect(() => {
    async function resolveFidRefFromContext() {
      try {
        const { sdk } = await import("@farcaster/miniapp-sdk");
        const ctx = await sdk.context;
        const embedUrl = ctx?.location?.embed;
        if (embedUrl) {
          const u = new URL(embedUrl);
          const fr = u.searchParams.get("fidref") ?? u.searchParams.get("ref");
          if (fr && /^\d+$/.test(fr)) {
            sessionStorage.setItem(FID_REF_KEY, fr);
          }
        }
      } catch {
        // context tidak tersedia di luar Farcaster
      }
    }
    resolveFidRefFromContext();
  }, []);

  useEffect(() => {
    if (!ready) return;

    let finalFid: number | null = null;
    const fid_ref = getFidRefFallback();

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
          fid_ref,
        }),
      }).catch((err) => console.error("Context user auto-upsert failed:", err));
    } else {
      try {
        const url = new URL(window.location.href);
        const qfid = url.searchParams.get("fid") || localStorage.getItem(FID_KEY);
        if (qfid && /^\d+$/.test(qfid)) finalFid = Number(qfid);
      } catch {}
    }

    if (finalFid) {
      localStorage.setItem(FID_KEY, String(finalFid));
      setResolvedFid(finalFid);
      try {
        const url = new URL(window.location.href);
        const ref = url.searchParams.get("ref");
        if (ref && isAddress(ref)) {
          localStorage.setItem("basetc_ref", ref);
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
        localStorage.setItem(FID_KEY, String(fid));
        setResolvedFid(fid);
      }}
    />
  );
}

export default function Page() {
  return (
    <Providers>
      <FarcasterProvider>
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-neutral-950 text-neutral-400">Loading App...</div>}>
          <AppInitializer />
        </Suspense>
      </FarcasterProvider>
    </Providers>
  );
}

