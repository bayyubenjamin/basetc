// app/components/AddMiniAppModal.tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";

type Status = { added: boolean; notificationsEnabled: boolean };

export default function AddMiniAppModal() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>({ added: false, notificationsEnabled: false });

  const refresh = useCallback(async () => {
    try {
      const fidStr = typeof window !== "undefined" ? localStorage.getItem("basetc_fid") : null;
      const fid = fidStr ? Number(fidStr) : 0;
      if (!fid) return; // belum tau fid → jangan tampilkan dulu

      const res = await fetch(`/api/miniapp-status?fid=${fid}`, { cache: "no-store" });
      const json: Status = await res.json();
      setStatus(json);
      setOpen(!json.added); // kalau belum added → tampilkan modal
    } catch {
      // kalau gagal cek server, tetap tampilkan modal agar user bisa klik
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    // cek saat mount
    void refresh();
    // cek ulang setelah 2s (misalnya user baru klik Add dan webhook sudah masuk)
    const t = setTimeout(() => void refresh(), 2000);
    return () => clearTimeout(t);
  }, [refresh]);

  async function handleAdd() {
    try {
      const add = (sdk.actions as any)?.addMiniApp as undefined | (() => Promise<void>);
      if (typeof add === "function") {
        await add(); // memunculkan sheet native
        // Setelah user klik "Add", pada buka berikutnya server akan mengembalikan added=true → modal hilang.
        setTimeout(() => void refresh(), 1500); // kasih waktu webhook tersimpan
      } else {
        alert("Buka Mini App ini di Farcaster untuk menambahkannya ke dashboard.");
      }
    } catch (e) {
      // user cancel / domain mismatch → biarkan modal tetap terbuka biar bisa coba lagi
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl border border-white/10 bg-neutral-900 p-4">
        <h3 className="mb-2 text-lg font-semibold">Tambahkan BaseTC ke Farcaster</h3>
        <p className="mb-4 text-sm text-neutral-300">
          Aktifkan notifikasi epoch harian & tampilkan BaseTC di dashboard kamu.
        </p>
        <div className="flex gap-2">
          <button onClick={handleAdd} className="fin-btn fin-btn-claim w-full">
            Add to Farcaster
          </button>
          <button onClick={() => setOpen(false)} className="w-full rounded-lg border py-2">
            Nanti
          </button>
        </div>
        <p className="mt-3 text-xs text-neutral-400">
          Status: {status.added ? "Added" : "Belum Added"}{status.notificationsEnabled ? " • Notifikasi aktif" : ""}
        </p>
      </div>
    </div>
  );
}

