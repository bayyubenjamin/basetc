// app/components/AddMiniAppPrompt.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";

type UiState = {
  host: string;
  hasAddFn: boolean;
  added: boolean | undefined;
  triedCount: number;
  lastError?: string;
};

export default function AddMiniAppPrompt() {
  const [ui, setUi] = useState<UiState>({
    host: "",
    hasAddFn: false,
    added: undefined,
    triedCount: 0,
  });
  const [fallbackOpen, setFallbackOpen] = useState(false);

  const booted = useRef(false);
  const opened = useRef(false);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;

    // Kumpulkan status awal untuk ditampilkan di bar
    try {
      const host = typeof window !== "undefined" ? window.location.hostname : "";
      const addFn = (sdk?.actions as any)?.addMiniApp;
      const added = (sdk as any)?.context?.client?.added as boolean | undefined;
      setUi((s) => ({ ...s, host, hasAddFn: typeof addFn === "function", added }));
    } catch {
      // biarkan default
    }

    // Otomatis panggil addMiniApp kalau belum Added (atau pakai ?forceAdd=1)
    let force = false;
    try {
      const p = new URLSearchParams(window.location.search);
      force = p.get("forceAdd") === "1";
    } catch {}

    const shouldOpen = force || !Boolean((sdk as any)?.context?.client?.added);
    if (!shouldOpen) return;

    // Retry sederhana: 150ms, 400ms, 900ms
    const delays = [150, 400, 900];
    const timers: number[] = [];

    delays.forEach((ms, i) => {
      const t = window.setTimeout(() => {
        void triggerAdd(i + 1);
      }, ms);
      timers.push(t);
    });

    // Jika setelah 1200ms masih tidak kebuka dan addFn tidak ada → tampilkan overlay
    const safety = window.setTimeout(() => {
      if (!opened.current) {
        const hasAdd = typeof (sdk?.actions as any)?.addMiniApp === "function";
        if (!hasAdd) setFallbackOpen(true);
      }
    }, 1200);

    return () => {
      timers.forEach((t) => clearTimeout(t));
      clearTimeout(safety);
    };
  }, []);

  async function triggerAdd(tryNo = 1) {
    const add = (sdk?.actions as any)?.addMiniApp as
      | (() => Promise<void>)
      | undefined;

    setUi((s) => ({
      ...s,
      hasAddFn: typeof add === "function",
      added: (sdk as any)?.context?.client?.added as boolean | undefined,
      triedCount: Math.max(s.triedCount, tryNo),
      lastError: undefined,
    }));

    if (typeof add !== "function") {
      // bukan di Warpcast / SDK lama → fallback overlay
      setFallbackOpen(true);
      return;
    }

    try {
      await add(); // ⬅️ sheet native Warpcast
      opened.current = true;
      setFallbackOpen(false);
    } catch (e: any) {
      // Bisa karena user cancel / domain mismatch / dll
      setUi((s) => ({ ...s, lastError: String(e?.message || e) }));
      setFallbackOpen(true);
    }
  }

  function handleManual() {
    void triggerAdd(ui.triedCount + 1);
  }
  function handleLater() {
    setFallbackOpen(false);
  }

  // 🔹 Status bar kecil di atas — selalu tampil
  const statusBar = (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10000,
        display: "flex",
        gap: 8,
        alignItems: "center",
        padding: "6px 8px",
        fontSize: 12,
        background: "#0f172a",
        color: "#a5f3fc",
        borderBottom: "1px solid rgba(165,243,252,.4)",
      }}
    >
      <b style={{ color: "#67e8f9" }}>MiniApp Status:</b>
      <span>host: {ui.host || "-"}</span>
      <span>| addMiniApp(): {String(ui.hasAddFn)}</span>
      <span>| added: {String(ui.added)}</span>
      <span>| tried: {ui.triedCount}</span>
      {ui.lastError ? <span style={{ color: "#fecaca" }}>| err: {ui.lastError}</span> : null}
      <button
        onClick={handleManual}
        style={{
          marginLeft: "auto",
          padding: "4px 8px",
          background: "#67e8f9",
          color: "#082f49",
          borderRadius: 6,
          fontWeight: 700,
        }}
      >
        Try addMiniApp()
      </button>
    </div>
  );

  // 🔸 Overlay fallback (punya app sendiri) — muncul kalau bukan di Warpcast / gagal
  const overlay = !fallbackOpen ? null : (
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

  return (
    <>
      {statusBar}
      {overlay}
    </>
  );
}

