// app/components/AddMiniAppPrompt.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";

export default function AddMiniAppPrompt() {
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const tried = useRef(false);

  useEffect(() => {
    // beri sinyal siap
    sdk.actions.ready?.().catch(() => {});

    if (tried.current) return;
    tried.current = true;

    // bisa paksa popup: ?forceAdd=1
    let force = false;
    try {
      const p = new URLSearchParams(window.location.search);
      force = p.get("forceAdd") === "1";
    } catch {}

    // 1) Coba baca status 'added' kalau tersedia; jika tidak, tetap coba
    const added = Boolean((sdk as any)?.context?.client?.added);
    const shouldOpen = force || !added;

    if (!shouldOpen) return;

    // 2) Delay singkat agar context siap di Warpcast
    const t = setTimeout(() => {
      void triggerAdd();
    }, 150);

    return () => clearTimeout(t);
  }, []);

  async function triggerAdd() {
    try {
      const add = (sdk.actions as any)?.addMiniApp as (() => Promise<void>) | undefined;

      // logging sementara (hapus kalau sdh ok)
      try {
        console.log("[AddMiniAppPrompt] added? ", (sdk as any)?.context?.client?.added,
          " addMiniApp:", typeof add);
      } catch {}

      if (typeof add === "function") {
        await add(); // ⬅️ ini yang memunculkan sheet native Warpcast
        setFallbackOpen(false);
      } else {
        // bukan di Warpcast / SDK lama → tampilkan overlay manual
        setFallbackOpen(true);
      }
    } catch (e) {
      // user cancel / domain mismatch / error lain → biar user bisa coba manual
      console.warn("[AddMiniAppPrompt] addMiniApp failed:", e);
      setFallbackOpen(true);
    }
  }

  function handleManual() {
    void triggerAdd();
  }
  function handleLater() {
    setFallbackOpen(false);
  }

  // Overlay fallback (punya app sendiri) muncul hanya bila bukan di Warpcast / error
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

