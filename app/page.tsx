"use client";

import { useEffect, useMemo, useState } from "react";
import Navigation, { type TabName } from "./components/Navigation";
import Monitoring from "./components/Monitoring";
import Rakit from "./components/Rakit";
import Market from "./components/Market";
import Profil from "./components/Profil";

const DEFAULT_TAB: TabName = "monitoring";
const TAB_KEY = "basetc_active_tab";

export default function Page() {
  const [activeTab, setActiveTab] = useState<TabName>(DEFAULT_TAB);

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

