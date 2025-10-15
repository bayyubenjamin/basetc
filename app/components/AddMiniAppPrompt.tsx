// app/components/AddMiniAppPrompt.tsx
"use client";
import { useEffect, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";

export default function AddMiniAppPrompt() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("basetc:add-miniapp-dismissed");
    if (!dismissed) setOpen(true); // tampilkan sekali bagi user baru
  }, []);

  async function handleAdd() {
    try {
      await sdk.actions.addMiniApp(); // memicu pop-up Add Mini App
      localStorage.setItem("basetc:add-miniapp-dismissed", "1");
      setOpen(false);
    } catch (e) {
      console.error("User menolak / domain tidak cocok manifest:", e);
    }
  }

  function handleLater() {
    localStorage.setItem("basetc:add-miniapp-dismissed", "1");
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl border border-[var(--stroke)] bg-[var(--card)] p-4">
        <h3 className="mb-2 text-lg font-semibold">Add BaseTC Mini App</h3>
        <p className="mb-4 text-sm">
          Tambahkan ke dashboard Farcaster & aktifkan notifikasi epoch harian.
        </p>
        <div className="flex gap-2">
          <button onClick={handleAdd} className="fin-btn fin-btn-claim w-full">
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

