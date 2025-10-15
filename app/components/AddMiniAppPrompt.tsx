// app/components/AddMiniAppPrompt.tsx
"use client";
import { useEffect, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";

export default function AddMiniAppPrompt() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // beri sinyal siap ke klien (jika ada)
    sdk.actions.ready?.().catch(() => {});

    // tampilkan hanya jika benar2 dibuka via Farcaster client
    const isMiniApp = Boolean((sdk as any)?.context?.client);
    const dismissed =
      typeof window !== "undefined"
        ? localStorage.getItem("basetc:add-miniapp-dismissed")
        : "1";

    if (isMiniApp && !dismissed) setOpen(true);
  }, []);

  async function handleAdd() {
    try {
      // Guard + cast: aman di TS, jalan kalau SDK punya addMiniApp
      const add = (sdk.actions as any)?.addMiniApp as
        | (() => Promise<void>)
        | undefined;

      if (typeof add === "function") {
        await add();
        localStorage.setItem("basetc:add-miniapp-dismissed", "1");
        setOpen(false);
      } else {
        alert(
          "Untuk menambahkan BaseTC ke Farcaster, buka Apps screen lalu Add. " +
            "Upgrade SDK agar tombol ini bekerja otomatis."
        );
      }
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

