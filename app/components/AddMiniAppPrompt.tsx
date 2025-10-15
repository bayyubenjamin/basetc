// app/components/AddMiniAppPrompt.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";

// Hindari double-trigger jika komponen dirender di banyak tempat
let __ADD_PROMPT_ALREADY_ATTEMPTED__ = false;

export default function AddMiniAppPrompt() {
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;

    // 1) Jangan crash kalau ready() tidak ada
    try {
      const ready = (sdk && (sdk as any).actions && (sdk as any).actions.ready) as
        | (() => any)
        | undefined;
      if (typeof ready === "function") {
        const res = ready();
        if (res && typeof (res as any).catch === "function") {
          (res as Promise<void>).catch(() => {});
        }
      }
    } catch {
      // abaikan
    }

    // 2) Cegah pemanggilan ganda di satu load
    if (__ADD_PROMPT_ALREADY_ATTEMPTED__) return;
    __ADD_PROMPT_ALREADY_ATTEMPTED__ = true;

    // 3) Force via query (?forceAdd=1)
    let force = false;
    try {
      const p = new URLSearchParams(window.location.search);
      force = p.get("forceAdd") === "1";
    } catch {}

    // 4) Kalau SDK tahu user sudah Add, jangan ganggu — kecuali force
    let alreadyAdded = false;
    try {
      alreadyAdded = Boolean((sdk as any)?.context?.client?.added);
    } catch {
      alreadyAdded = false;
    }
    if (!force && alreadyAdded) return;

    // 5) Coba panggil addMiniApp() dengan guard total
    const t = window.setTimeout(() => {
      void safeTriggerAdd(setFallbackOpen);
    }, 180);

    // 6) Kalau setelah 1.2s function addMiniApp() tak ada, tampilkan overlay fallback
    const t2 = window.setTimeout(() => {
      try {
        const add = (sdk && (sdk as any).actions && (sdk as any).actions.addMiniApp) as
          | (() => Promise<void>)
          | undefined;
        if (typeof add !== "function") {
          setFallbackOpen(true);
        }
      } catch {
        setFallbackOpen(true);
      }
    }, 1200);

    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, []);

  function handleManual() {
    void safeTriggerAdd(setFallbackOpen);
  }
  function handleLater() {
    setFallbackOpen(false);
  }

  // Overlay fallback (milik app sendiri). Tampil kalau bukan di Warpcast / method tidak ada / user cancel.
  if (!fallbackOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl border border-[var(--stroke,#3a3a3a)] bg-[var(--card,#0b0b0b)] p-4">
        <h3 className="mb-2 text-lg font-semibold">Add BaseTC Mini App</h3>
        <p className="mb-4 text-sm">
          Tambahkan ke dashboard Farcaster & aktifkan notifikasi epoch harian.
        </p>
        <div className="flex gap-2">
          <button onClick={handleManual} className="fin-btn fin-btn-claim w-full">
            Add to Farcaster
          </button>
          <button onClick={handleLater} className="w-full rounded-lg border py-2">
            Nanti
          </button>
        </div>
      </div>
    </div>
  );
}

/** Memanggil addMiniApp() secara aman (tidak melempar error ke UI) */
async function safeTriggerAdd(setFallbackOpen: (v: boolean) => void) {
  try {
    const actions = (sdk && (sdk as any).actions) || undefined;
    const add = actions && (actions as any).addMiniApp;
    if (typeof add === "function") {
      await add(); // -> membuka sheet native Warpcast
      setFallbackOpen(false);
      return;
    }
  } catch {
    // user cancel / domain mismatch / lain-lain -> jatuhkan ke fallback
  }
  setFallbackOpen(true);
}

