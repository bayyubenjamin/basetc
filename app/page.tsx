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

// helper: ambil context Farcaster robust (getContext / context fn / promise) + retry
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
    for (let i = 0; i < 6; i++) { // retry ~3 detik total
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

  // init: Farcaster SDK ready + restore tab dari ?tab= atau localStorage
  useEffect(() => {
    (async () => {
      try {
        const { sdk } = await import("@farcaster/miniapp-sdk");
        sdk.actions.ready?.();
      } catch (err) {
        console.warn("[miniapp] SDK not available:", err);
      }
    })();

    try {
      const url = new URL(window.location.href);
      const q = (url.searchParams.get("tab") || "").toLowerCase();
      const fromQuery = ["monitoring", "rakit", "market", "profil"].includes(q)
        ? (q as TabName)
        : null;
      const fromStorage = (localStorage.getItem(TAB_KEY) || "") as TabName;
      const initial =
        fromQuery ||
        (["monitoring", "rakit", "market", "profil"].includes(fromStorage)
          ? fromStorage
          : DEFAULT_TAB);
      setActiveTab(initial);
    } catch {
      setActiveTab(DEFAULT_TAB);
    }
  }, []);

  // === Auto-upsert user ke Supabase dari Farcaster context (landing)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const u = await getFarcasterContextUser();

      // fallback: kalau context kosong, coba ambil dari ?fid / localStorage
      if (!u.fid) {
        try {
          const url = new URL(window.location.href);
          const qfid = url.searchParams.get("fid") || localStorage.getItem("basetc_fid");
          if (qfid && /^\d+$/.test(qfid)) u.fid = Number(qfid);
        } catch {}
      }

      if (!u.fid || cancelled) return;

      try { localStorage.setItem("basetc_fid", String(u.fid)); } catch {}

      // upsert profil dasar (tanpa wallet)
      try {
        await fetch("/api/user", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            fid: u.fid,
            wallet: null,
            username: u.username ?? null,
            display_name: u.displayName ?? null,
            pfp_url: u.pfpUrl ?? null,
          }),
        });
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  // === Lengkapi mapping fid ↔ wallet ketika wallet tersedia
  useEffect(() => {
    (async () => {
      if (!address) return;
      let fidStr: string | null = null;
      try {
        const url = new URL(window.location.href);
        fidStr = url.searchParams.get("fid") || localStorage.getItem("basetc_fid");
      } catch {}
      if (!fidStr || !/^\d+$/.test(fidStr)) return;

      await fetch("/api/user", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fid: Number(fidStr), wallet: address }),
      }).catch(() => {});
    })();
  }, [address]);

  // === Referral 'touch' saat landing (Home)
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const fid = url.searchParams.get("fid");
      const ref = url.searchParams.get("ref");

      if (fid && /^\d+$/.test(fid)) localStorage.setItem("basetc_fid", fid);
      if (ref && /^0x[0-9a-fA-F]{40}$/.test(ref)) localStorage.setItem("basetc_ref", ref);

      if (fid && /^\d+$/.test(fid) && ref && /^0x[0-9a-fA-F]{40}$/.test(ref)) {
        fetch("/api/referral", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "touch",
            inviter: ref,
            invitee_fid: Number(fid),
          }),
        }).catch(() => {});
      }
    } catch {}
  }, []);

  // simpan tab + scroll to top saat tab berubah
  useEffect(() => {
    try {
      localStorage.setItem(TAB_KEY, activeTab);
    } catch {}
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [activeTab]);

  // pilih konten
  const content = useMemo(() => {
    switch (activeTab) {
      case "rakit":
        return <Rakit />;
      case "market":
        return <Market />;
      case "profil":
        return <Profil />;
      case "monitoring":
      default:
        return <Monitoring />;
    }
  }, [activeTab]);

  return (
    <div className="flex flex-col min-h-screen">
      {/* padding bottom untuk nav + safe area iOS */}
      <div
        className="flex-1"
        style={{ paddingBottom: "calc(4rem + env(safe-area-inset-bottom, 0px))" }}
      >
        {content}
      </div>

      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}

