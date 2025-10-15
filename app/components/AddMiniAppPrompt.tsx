// app/components/AddMiniAppPrompt.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";

export default function AddMiniAppPrompt() {
  const [fallbackOpen, setFallbackOpen] = useState(false); // overlay manual kalau bukan di Warpcast/SDK lama
  const tried = useRef(false); // supaya tidak loop dalam 1 page open

  useEffect(() => {
    sdk.actions.ready?.().catch(() => {});

    // bisa paksa muncul: ?forceAdd=1
    let force = false;
    try {
      const p = new URLSearchParams(window.location.search);
      force = p.get("forceAdd") === "1";
    } catch {}

    if (tried.current) return;
    tried.current = true;

    const ctx = (sdk as any)?.context;
    const isAdded = Boolean(ctx?.client?.added); // true kalau user sudah Add di klien Farcaster

    if (!isAdded || force) {
      void triggerAdd();
    }
  }, []);

  async function triggerAdd() {
    try {
      const add = (sdk.actions as any)?.addMiniApp as (() => Promise<void>) | undefined;
      if (typeof add === "function") {
        // Ini akan memunculkan sheet native Farcaster: "Add to Farcaster" + "Enable notifications"
        await add();
        setFallbackOpen(false);
      } else {
        // Bukan di Warpcast atau SDK lama -> tampilkan overlay manual
        setFallbackOpen(true);
      }
    } catch {
      // User menekan "Not now" atau error domain/manifest
      setFallbackOpen(true);
    }
  }

  function handleManual() {
    void triggerAdd();
  }
  function handleLater() {
    setFallbackOpen(false);
  }

  // Overlay fallback (punya app sendiri). Tidak akan tampil jika sheet native berhasil muncul.
  if (!fallbackOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl border border-[var(--stroke)] bg-[var(--card)] p-4">
        <h3 className="mb-2 text-lg font-semibold">Add BaseTC Mini App</h3>
        <p className="mb-4 text-sm">Tambahkan ke dashboard Farcaster & aktifkan notifikasi epoch harian.</p>
        <div className="flex gap-2">
          <button onClick={handleManual} className="fin-btn fin-btn-claim w-full">Add to Farcaster</button>
          <button onClick={handleLater} className="w-full rounded-lg border py-2">Nanti</button>
        </div>
      </div>
    </div>
  );
}

