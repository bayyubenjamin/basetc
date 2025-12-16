// app/components/SilentAddMiniApp.tsx
"use client";

import { useEffect, useRef } from "react";
import { sdk } from "@farcaster/miniapp-sdk";

// flag modul agar tidak double-trigger kalau di-mount di layout + page
let __SILENT_ADD_ATTEMPTED__ = false;

export default function SilentAddMiniApp() {
  const triedThisSession = useRef(false);

  useEffect(() => {
    // 1. CEK LINGKUNGAN: Jika di Base App / Coinbase Wallet, JANGAN jalankan script ini.
    // Base App (Wallet) tidak mendukung fitur "Add Mini App" ala Farcaster.
    // Jika dipaksa, dia akan melempar user keluar ke Warpcast.
    const isBaseApp = 
      (typeof window !== "undefined" && (window as any).ethereum) || 
      (typeof navigator !== "undefined" && 
        (navigator.userAgent.includes("Coinbase") || navigator.userAgent.includes("Base")));

    if (isBaseApp) return;

    // --- BATAS AMAN: Kode di bawah hanya jalan di Farcaster Client (Warpcast/Supercast) ---

    // cegah double attempt lintas mount
    if (__SILENT_ADD_ATTEMPTED__) return;
    __SILENT_ADD_ATTEMPTED__ = true;

    // helper: get fid dari localStorage
    const getFid = () => {
      try {
        const s = localStorage.getItem("basetc_fid");
        const n = s ? Number(s) : 0;
        return Number.isFinite(n) && n > 0 ? n : 0;
      } catch {
        return 0;
      }
    };

    // helper: cek status server
    async function isAddedOnServer(): Promise<boolean> {
      const fid = getFid();
      if (!fid) return false;
      try {
        const r = await fetch(`/api/miniapp-status?fid=${fid}`, { cache: "no-store" });
        const j = await r.json();
        return Boolean(j?.added);
      } catch {
        return false;
      }
    }

    // panggil addMiniApp aman (tanpa UI)
    async function tryAdd() {
      if (triedThisSession.current) return;
      triedThisSession.current = true;

      const serverAdded = await isAddedOnServer();
      if (serverAdded) return;

      try {
        const actions: any = (sdk as any)?.actions;
        const add = actions?.addMiniApp as undefined | (() => Promise<void>);
        if (typeof add === "function") {
          await add();
        }
      } catch {
        // user cancel / domain mismatch / dll → diam.
      }
    }

    // Eksekusi logic add
    void tryAdd();

    const t = window.setTimeout(() => {
      void tryAdd();
    }, 400);

    const onVis = () => {
      if (document.visibilityState === "visible") {
        void tryAdd();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    const fireOnce = () => {
      void tryAdd();
    };
    window.addEventListener("click", fireOnce, { once: true, capture: true });
    window.addEventListener("touchstart", fireOnce, { once: true, capture: true });
    window.addEventListener("focus", fireOnce, { once: true, capture: true });

    return () => {
      clearTimeout(t);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("click", fireOnce, { capture: true } as any);
      window.removeEventListener("touchstart", fireOnce, { capture: true } as any);
      window.removeEventListener("focus", fireOnce, { capture: true } as any);
    };
  }, []);

  return null;
}
