"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import Navigation, { type TabName } from "./components/Navigation";
import Monitoring from "./components/Monitoring";
import Rakit from "./components/Rakit";
import Market from "./components/Market";
import Profil from "./components/Profil";
// Impor fungsi yang sudah diperbaiki dari farcaster.ts
import { getFarcasterIds, sdkReady } from "./lib/farcaster";
import { isAddress } from "viem";

const DEFAULT_TAB: TabName = "monitoring";
const TAB_KEY = "basetc_active_tab";

export default function Page() {
  const [activeTab, setActiveTab] = useState<TabName>(DEFAULT_TAB);
  const { address } = useAccount();

  // Efek ini berjalan sekali saat komponen pertama kali dimuat.
  // Tugasnya adalah memberi tahu Farcaster SDK bahwa aplikasi siap dan
  // mengembalikan pengguna ke tab terakhir yang mereka buka.
  useEffect(() => {
    // Memberi sinyal ke Farcaster bahwa Mini App sudah siap ditampilkan.
    sdkReady();

    try {
      const url = new URL(window.location.href);
      const refFromUrl = url.searchParams.get('ref');

      // Jika ada parameter 'ref' di URL, simpan sebagai inviter di localStorage.
      // Ini memastikan link referral tetap berfungsi meski pengguna berpindah tab.
      if (refFromUrl && isAddress(refFromUrl)) {
        localStorage.setItem("basetc_ref", refFromUrl);
      }
      
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

  // [REVISI UTAMA]
  // Efek ini adalah jantung dari inisialisasi pengguna.
  // Dijalankan setiap kali 'address' (wallet) berubah (saat connect/disconnect).
  // Ini menggabungkan semua logika penting ke dalam satu tempat untuk menghindari race condition.
  useEffect(() => {
    const initializeUserAndReferral = async () => {
      // 1. Ambil semua informasi dari Farcaster dalam satu panggilan.
      //    Fungsi getFarcasterIds sudah dibuat robust dengan retry.
      const { fid, userProfile } = await getFarcasterIds();

      // Jika tidak mendapatkan FID, hentikan proses.
      if (!fid) {
        console.warn("Could not get Farcaster FID. User initialization stopped.");
        return;
      }
      
      // Simpan FID ke localStorage agar bisa diakses komponen lain sebagai fallback.
      localStorage.setItem("basetc_fid", String(fid));

      // 2. Lakukan "Referral Touch"
      //    Ini untuk mencatat referral yang statusnya masih 'pending' di database.
      const inviterAddress = localStorage.getItem("basetc_ref");
      if (inviterAddress) {
        fetch("/api/referral", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "touch",
            inviter: inviterAddress,
            invitee_fid: fid,
            invitee_wallet: address, // Sertakan wallet jika sudah terhubung
          }),
        }).catch(console.warn); // Lanjutkan eksekusi meski fetch ini gagal.
      }

      // 3. Lakukan Auto-Upsert Pengguna ke Supabase
      //    Ini akan membuat data pengguna baru atau memperbarui data yang sudah ada (misal, menambahkan alamat wallet).
      await fetch("/api/user", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fid: fid,
          wallet: address ?? null, // Selalu kirim status wallet terbaru.
          username: userProfile?.username ?? null,
          display_name: userProfile?.displayName ?? null,
          pfp_url: userProfile?.pfpUrl ?? null,
        }),
      }).catch(console.warn); // Lanjutkan eksekusi meski fetch ini gagal.
    };

    initializeUserAndReferral();
  }, [address]); // <-- Bergantung pada 'address', jadi akan berjalan lagi saat wallet terhubung.


  // Efek ini untuk menyimpan tab aktif ke localStorage
  // agar pengalaman pengguna konsisten saat kembali ke aplikasi.
  useEffect(() => {
    try {
      localStorage.setItem(TAB_KEY, activeTab);
    } catch {}
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [activeTab]);


  // Gunakan useMemo untuk efisiensi, agar komponen tidak di-render ulang
  // jika tab tidak berubah.
  const content = useMemo(() => {
    switch (activeTab) {
      case "rakit":
        return <Rakit />;
      case "market":
        // Kirim prop onTransactionSuccess untuk refresh data jika diperlukan
        return <Market onTransactionSuccess={() => console.log('transaksi berhasil')} />;
      case "profil":
        return <Profil />;
      case "monitoring":
      default:
        return <Monitoring />;
    }
  }, [activeTab]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white">
      {/* Padding di bawah untuk memberi ruang bagi navigation bar di mobile */}
      <main
        className="flex-1"
        style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom, 0px))" }}
      >
        {content}
      </main>
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}

