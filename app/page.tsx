"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi"; // [NEW] untuk ambil wallet kalau sudah auto-connect
import Navigation, { type TabName } from "./components/Navigation";
import Monitoring from "./components/Monitoring";
import Rakit from "./components/Rakit";
import Market from "./components/Market";
import Profil from "./components/Profil";

const DEFAULT_TAB: TabName = "monitoring";
const TAB_KEY = "basetc_active_tab";

export default function Page() {
  const [activeTab, setActiveTab] = useState<TabName>(DEFAULT_TAB);
  const { address } = useAccount(); // [NEW]

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

  // === [NEW] Upsert user ke Supabase dari Farcaster context saat landing
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { sdk } = await import("@farcaster/miniapp-sdk");
        const raw = (sdk as any)?.context;
        const ctx = typeof raw === "function" ? await raw.call(sdk) : await raw;
        const user = ctx?.user;
        if (!user?.fid) return;

        // persist FID ke localStorage
        try { localStorage.setItem("basetc_fid", String(user.fid)); } catch {}

        // upsert profil dasar (tanpa wallet dulu)
        if (!cancelled) {
          await fetch("/api/user", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              fid: Number(user.fid),
              wallet: null,
              username: user.username ?? null,
              display_name: user.displayName ?? null,
              pfp_url: user.pfpUrl ?? null,
            }),
          }).catch(() => {});
        }
      } catch {
        // bukan di konteks Farcaster → skip
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // === [NEW] Lengkapi mapping fid ↔ wallet begitu wallet tersedia
  useEffect(() => {
    (async () => {
      if (!address) return;
      // ambil fid dari localStorage / query bila ada
      let fidStr: string | null = null;
      try {
        const url = new URL(window.location.href);
        fidStr = url.searchParams.get("fid") || localStorage.getItem("basetc_fid");
      } catch {}
      if (!fidStr || !/^\d+$/.test(fidStr)) return;

      await fetch("/api/user", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fid: Number(fidStr),
          wallet: address,
        }),
      }).catch(() => {});
    })();
  }, [address]);

  // === Referral 'touch' saat landing (Home)
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const fid = url.searchParams.get("fid");
      const ref = url.searchParams.get("ref");

      // simpan ke localStorage supaya persist pindah halaman
      if (fid && /^\d+$/.test(fid)) localStorage.setItem("basetc_fid", fid);
      if (ref && /^0x[0-9a-fA-F]{40}$/.test(ref)) localStorage.setItem("basetc_ref", ref);

      // kirim 'pending/touch' ke backend sekali saat landing
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

