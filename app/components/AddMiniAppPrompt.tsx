// app/components/AddMiniAppPrompt.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";

export default function AddMiniAppPrompt() {
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const triedRef = useRef(false);
  const openedRef = useRef(false);

  useEffect(() => {
    // Guard siapin client; jangan panggil .catch pada undefined
    try {
      const maybeReady = (sdk?.actions as any)?.ready;
      if (typeof maybeReady === "function") {
        const res = maybeReady();
        if (res && typeof (res as any).catch === "function") {
          (res as Promise<void>).catch(() => {});
        }
      }
    } catch {
      // ignore
    }

    if (triedRef.current) return;
    triedRef.current = true;

    // ?forceAdd=1 untuk paksa munculin sheet
    let force = false;
    try {
      const p = new URLSearchParams(window.location.search);
      force = p.get("forceAdd") === "1";
    } catch {}

    // baca status added kalau ada; kalau undefined, kita tetap coba
    const added = Boolean((sdk as any)?.context?.client?.added);
    const shouldOpen = force || !added;
    if (!shouldOpen) return;

    const t = setTimeout(() => {
      void triggerAdd();
    }, 150);

    // kalau dalam 800ms tidak kebuka & addMiniApp nggak ada → tampilkan overlay
    const t2 = setTimeout(() => {
      if (!openedRef.current) {
        const hasAdd = typeof ((sdk?.actions as any)?.addMiniApp) === "function";
        if (!hasAdd) setFallbackOpen(true);
      }
    }, 800);

    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, []);

  async function triggerAdd() {
    try {
      const add = (sdk?.actions as any)?.addMiniApp as
        | (() => Promise<void>)
        | undefined;

      if (typeof add === "function") {
        await add();           // ⬅️ sheet native Warpcast
        openedRef.current = true;
        setFallbackOpen(false);
      } else {
        // bukan di Warpcast / SDK lama
        setFallbackOpen(true);
      }
    } catch {
      // user cancel / domain mismatch / error lain
      setFallbackOpen(true);
    }
  }

  function handleManual() {
    void triggerAdd();
  }
  function handleLater() {
    setFallbackOpen(false);
  }

  // Overlay fallback kalau addMiniApp tidak ada / gagal
  if (!fallbackOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl border border-[var(--stroke)] bg-[var(--card)] p-4">
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

