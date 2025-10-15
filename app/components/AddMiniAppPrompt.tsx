// app/components/AddMiniAppPrompt.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";

type DebugState = {
  host: string;
  hasAddFn: boolean;
  added: unknown;
  tried: boolean;
  lastError?: string;
};

export default function AddMiniAppPrompt() {
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const [dbg, setDbg] = useState<DebugState>({
    host: "",
    hasAddFn: false,
    added: undefined,
    tried: false,
  });

  const triedRef = useRef(false);
  const openedRef = useRef(false); // menandai kalau sheet berhasil dipanggil

  useEffect(() => {
    // ✅ Guard sebelum memanggil ready()
    try {
      const maybeReady = (sdk.actions as any)?.ready;
      if (typeof maybeReady === "function") {
        Promise.resolve(maybeReady()).catch(() => {});
      }
    } catch {}

    if (triedRef.current) return;
    triedRef.current = true;

    // baca query opsional
    let force = false;
    try {
      const p = new URLSearchParams(window.location.search);
      force = p.get("forceAdd") === "1";
    } catch {}

    // capture kondisi awal (untuk debug chip)
    const added = (sdk as any)?.context?.client?.added;
    const addFn = (sdk.actions as any)?.addMiniApp;
    setDbg({
      host: typeof window !== "undefined" ? window.location.hostname : "",
      hasAddFn: typeof addFn === "function",
      added,
      tried: false,
    });

    const shouldOpen = force || !Boolean(added);
    if (!shouldOpen) return;

    // beri sedikit delay agar context siap
    const t = setTimeout(() => {
      void triggerAdd();
    }, 150);

    // jika 800ms tidak terbuka & addMiniApp tidak ada → tampilkan overlay fallback
    const t2 = setTimeout(() => {
      if (!openedRef.current) {
        const hasAdd = typeof (sdk.actions as any)?.addMiniApp === "function";
        if (!hasAdd) setFallbackOpen(true);
      }
    }, 800);

    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, []);

  async function triggerAdd() {
    const add = (sdk.actions as any)?.addMiniApp as
      | (() => Promise<void>)
      | undefined;

    const hasAddFn = typeof add === "function";
    const addedNow = (sdk as any)?.context?.client?.added;

    setDbg((d) => ({
      ...d,
      hasAddFn,
      added: addedNow,
      tried: true,
      lastError: undefined,
    }));

    if (!hasAddFn) {
      // bukan di Warpcast/SDK lama → overlay manual
      setFallbackOpen(true);
      return;
    }

    try {
      await add(); // ⬅️ ini memunculkan sheet native Warpcast
      openedRef.current = true;
      setFallbackOpen(false);
    } catch (e: any) {
      setDbg((d) => ({ ...d, lastError: String(e?.message || e) }));
      setFallbackOpen(true); // biar user bisa klik manual
    }
  }

  function handleManual() {
    void triggerAdd();
  }
  function handleLater() {
    setFallbackOpen(false);
  }

  // 🔎 Debug chip kecil (biar bisa “lihat” state meski tanpa console)
  const debugChip = (
    <div
      style={{
        position: "fixed",
        right: 8,
        bottom: 8,
        zIndex: 10000,
        fontSize: 12,
        background: "#0b0b0b",
        color: "#9efcff",
        border: "1px solid #9efcff",
        borderRadius: 8,
        padding: "8px 10px",
        maxWidth: 280,
        boxShadow: "0 0 0 1px rgba(0,0,0,.3)",
        opacity: 0.9,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>debugAdd</div>
      <div>host: {dbg.host || "-"}</div>
      <div>has addMiniApp(): {String(dbg.hasAddFn)}</div>
      <div>context.client.added: {String(dbg.added)}</div>
      <div>already tried: {String(dbg.tried)}</div>
      {dbg.lastError ? <div>lastError: {dbg.lastError}</div> : null}
      <button
        onClick={() => triggerAdd()}
        style={{
          marginTop: 6,
          padding: "6px 8px",
          background: "#9efcff",
          color: "#001015",
          borderRadius: 6,
          fontWeight: 700,
          width: "100%",
        }}
      >
        Try addMiniApp()
      </button>
    </div>
  );

  // Overlay fallback (punya app sendiri)
  return (
    <>
      {debugChip}
      {fallbackOpen && (
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
      )}
    </>
  );
}

