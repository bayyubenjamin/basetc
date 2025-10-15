// app/components/SilentAddMiniApp.tsx
"use client";

import { useEffect, useRef } from "react";
import { sdk } from "@farcaster/miniapp-sdk";

/**
 * Komponen ini tidak merender UI.
 * Tugasnya:
 * 1) Cek ke server apakah user sudah "Add" Mini App (via /api/miniapp-status?fid=...).
 * 2) Kalau BELUM, coba panggil sdk.actions.addMiniApp() sekali per session.
 * 3) Tambah "pemicu halus" berbasis gesture (click/touchstart/focus/visibility) supaya lolos kebijakan klien yg butuh user gesture.
 * 4) Retry ringan ketika kembali ke foreground.
 */

// flag modul agar tidak double-trigger kalau di-mount di layout + page
let __SILENT_ADD_ATTEMPTED__ = false;

export default function SilentAddMiniApp() {
  const triedThisSession = useRef(false);

  useEffect(() => {
    // cegah double attempt lintas mount
    if (__SILENT_ADD_ATTEMPTED__) return;
    __SILENT_ADD_ATTEMPTED__ = true;

    // helper: get fid dari localStorage (kamu sudah set di AppInitializer)
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
        // kalau gagal cek, anggap belum supaya kita tetap coba memicu
        return false;
      }
    }

    // panggil addMiniApp aman (tanpa UI)
    async function tryAdd() {
      if (triedThisSession.current) return;
      triedThisSession.current = true;

      // kalau server sudah bilang "added", jangan ganggu
      const serverAdded = await isAddedOnServer();
      if (serverAdded) return;

      try {
        const actions: any = (sdk as any)?.actions;
        const add = actions?.addMiniApp as undefined | (() => Promise<void>);
        if (typeof add === "function") {
          await add();
          // tidak perlu set apa-apa; pada bukaan berikutnya server harus sudah "added=true"
        }
      } catch {
        // user cancel / domain mismatch / dll → cukup diam. Gesture berikutnya akan coba lagi.
      }
    }

    // 1) attempt segera (auto)
    //   — bisa saja diabaikan klien, tidak apa-apa; gesture akan jadi back-up
    void tryAdd();

    // 2) attempt lagi setelah sedikit jeda (kadang context siap setelah render)
    const t = window.setTimeout(() => {
      void tryAdd();
    }, 400);

    // 3) saat kembali ke foreground / visibility berubah → coba lagi sekali
    const onVis = () => {
      if (document.visibilityState === "visible") {
        void tryAdd();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    // 4) tangkap GESTURE pertama (klik/tap/focus) → coba panggil (tanpa UI)
    const fireOnce = () => {
      void tryAdd();
    };
    window.addEventListener("click", fireOnce, { once: true, capture: true });
    window.addEventListener("touchstart", fireOnce, { once: true, capture: true });
    window.addEventListener("focus", fireOnce, { once: true, capture: true });

    return () => {
      clearTimeout(t);
      document.removeEventListener("visibilitychange", onVis);
      // listeners "once: true" akan otomatis hilang setelah satu kali, tapi aman juga kalau dibersihkan:
      window.removeEventListener("click", fireOnce, { capture: true } as any);
      window.removeEventListener("touchstart", fireOnce, { capture: true } as any);
      window.removeEventListener("focus", fireOnce, { capture: true } as any);
    };
  }, []);

  return null;
}

