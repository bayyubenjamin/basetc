"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import Navigation, { type TabName } from "./components/Navigation";
import Monitoring from "./components/Monitoring";
import Rakit from "./components/Rakit";
import Market from "./components/Market";
import Profil from "./components/Profil";

const DEFAULT_TAB: TabName = "monitoring";
const TAB_KEY = "basetc_active_tab";

// Helper function to robustly get Farcaster context user data.
// It retries several times to handle the SDK injection race condition.
async function getFarcasterContextUser(): Promise<{
  fid: number | null;
  username: string | null;
  displayName: string | null;
  pfpUrl: string | null;
}> {
  try {
    const { sdk }: any = await import("@farcaster/miniapp-sdk");
    try { await sdk?.actions?.ready?.(); } catch {}

    const tryGet = async () => {
      if (typeof sdk?.getContext === "function") return await sdk.getContext();
      const raw = sdk?.context;
      if (typeof raw === "function") return await raw.call(sdk);
      if (raw && typeof raw.then === "function") return await raw;
      return raw ?? null;
    };

    let ctx: any = null;
    for (let i = 0; i < 6; i++) { // Retry for ~3 seconds total
      ctx = await tryGet();
      if (ctx?.user?.fid) break;
      await new Promise(r => setTimeout(r, 500));
    }

    const u = ctx?.user ?? {};
    return {
      fid: u?.fid ?? null,
      username: u?.username ?? null,
      displayName: u?.displayName ?? null,
      pfpUrl: u?.pfpUrl ?? null,
    };
  } catch {
    return { fid: null, username: null, displayName: null, pfpUrl: null };
  }
}

export default function Page() {
  const [activeTab, setActiveTab] = useState<TabName>(DEFAULT_TAB);
  const { address } = useAccount();

  // This effect runs once on component mount to initialize the app.
  useEffect(() => {
    let isCancelled = false;
    const initializeApp = async () => {
      // 1. Get Farcaster user context, with fallbacks to URL params and localStorage.
      const fcUser = await getFarcasterContextUser();
      if (!fcUser.fid) {
        try {
          const url = new URL(window.location.href);
          const qfid = url.searchParams.get("fid") || localStorage.getItem("basetc_fid");
          if (qfid && /^\d+$/.test(qfid)) fcUser.fid = Number(qfid);
        } catch {}
      }

      if (isCancelled || !fcUser.fid) return;

      // 2. Persist FID in localStorage for later use (e.g., when wallet connects).
      localStorage.setItem("basetc_fid", String(fcUser.fid));

      // 3. Auto-upsert user profile to Supabase via our secure API route.
      fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fid: fcUser.fid,
          username: fcUser.username,
          display_name: fcUser.displayName,
          pfp_url: fcUser.pfpUrl,
        }),
      }).catch(err => console.error("Initial user auto-upsert failed:", err));

      // 4. Handle referral "touch" to create a pending referral record.
      try {
        const url = new URL(window.location.href);
        const ref = url.searchParams.get("ref");
        if (ref && /^0x[0-9a-fA-F]{40}$/.test(ref)) {
          localStorage.setItem("basetc_ref", ref);
          fetch("/api/referral", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mode: "touch",
              inviter: ref,
              invitee_fid: fcUser.fid,
            }),
          }).catch(err => console.error("Referral touch failed:", err));
        }
      } catch {}
    };

    initializeApp();
    return () => { isCancelled = true; };
  }, []);

  // This effect runs whenever the wallet address changes (e.g., on connect).
  // It updates the user record in Supabase to map the FID to the wallet address.
  useEffect(() => {
    if (!address) return;
    const fidStr = localStorage.getItem("basetc_fid");
    if (!fidStr) return; // Can't map if we don't know the FID

    fetch("/api/user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fid: Number(fidStr),
        wallet: address, // Add or update the wallet address for this FID
      }),
    }).catch(err => console.error("Wallet mapping upsert failed:", err));
  }, [address]);

  // Tab management logic (restored from original file)
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const q = (url.searchParams.get("tab") || "").toLowerCase();
      const validTabs: TabName[] = ["monitoring", "rakit", "market", "profil"];
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

  const content = useMemo(() => {
    switch (activeTab) {
      case "rakit": return <Rakit />;
      case "market": return <Market />;
      case "profil": return <Profil />;
      default: return <Monitoring />;
    }
  }, [activeTab]);

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 pb-24"> {/* Adjusted padding */}
        {content}
      </main>
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}

