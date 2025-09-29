"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import Navigation, { type TabName } from "./components/Navigation";
import Monitoring from "./components/Monitoring";
import Rakit from "./components/Rakit";
import Market from "./components/Market";
import Profil from "./components/Profil";
import { useFarcaster } from "./context/FarcasterProvider"; // Import hook terpusat

const DEFAULT_TAB: TabName = "monitoring";
const TAB_KEY = "basetc_active_tab";

export default function Page() {
  const [activeTab, setActiveTab] = useState<TabName>(DEFAULT_TAB);
  const { address } = useAccount();
  
  // INTI PERBAIKAN: Menggunakan FID dan data user dari context.
  // Tidak ada lagi state atau logic manual untuk mendapatkan FID di sini.
  const { fid, user } = useFarcaster();

  // Effect untuk auto-save profil Farcaster & menangani referral.
  // Fungsionalitas ini tetap ada, namun sekarang bergantung pada `fid` dari context,
  // membuatnya lebih andal.
  useEffect(() => {
    if (!fid || !user) return;

    // 1. Auto-upsert profil pengguna ke Supabase.
    // Hanya berjalan jika ada data lengkap dari Farcaster context.
    if (user.username && user.username !== `fid:${fid}`) {
       fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fid: user.fid,
          username: user.username,
          display_name: user.displayName,
          pfp_url: user.pfpUrl,
        }),
      }).catch(err => console.error("Initial user auto-upsert failed:", err));
    }

    // 2. Menangani "touch" referral dari URL.
    try {
      const url = new URL(window.location.href);
      const ref = url.searchParams.get("ref");
      // Cek jika parameter 'ref' adalah alamat wallet yang valid
      if (ref && /^0x[0-9a-fA-F]{40}$/.test(ref)) {
        localStorage.setItem("basetc_ref", ref);
        fetch("/api/referral", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "touch",
            inviter: ref,
            invitee_fid: fid,
          }),
        }).catch(err => console.error("Referral touch failed:", err));
      }
    } catch (e) {
      console.warn("Could not process referral param:", e);
    }
  }, [fid, user]);

  // Effect untuk memetakan wallet address ke FID di database.
  // Fungsionalitas ini juga tetap ada dan bergantung pada `address` dan `fid`.
  useEffect(() => {
    if (!address || !fid) return;

    fetch("/api/user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fid: fid,
        wallet: address,
      }),
    }).catch(err => console.error("Wallet mapping upsert failed:", err));
  }, [address, fid]);

  // Logika manajemen Tab (tidak berubah)
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

  // Desain utama dan struktur layout tidak berubah
  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 pb-24">
        {content}
      </main>
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}

