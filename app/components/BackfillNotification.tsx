"use client";
import { useEffect, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";

/**
 * Backfill otomatis:
 * - Jika client context sudah punya notificationDetails (artinya user dulu sudah enable),
 *   kirim fid+url+token ke server agar tercatat di Supabase.
 * - Jika belum ada, tampilkan nudge kecil agar user Enable Notifications.
 */
export default function BackfillNotification() {
  const [done, setDone] = useState(false);
  const [needsNudge, setNeedsNudge] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const ctx = await sdk.context;
        const fid = Number(ctx?.user?.fid || 0);
        const nd  = ctx?.client?.notificationDetails; // url + token jika sudah enable:contentReference[oaicite:2]{index=2}

        if (fid > 0 && nd?.url && nd?.token) {
          // kirim ke server untuk di-upsert
          await fetch("/api/notifications/upsert", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fid, url: nd.url, token: nd.token }),
          });
          setDone(true);
          setNeedsNudge(false);
        } else {
          // tidak ada token di context => user belum enable notif
          setNeedsNudge(true);
        }
      } catch {
        setNeedsNudge(true);
      }
    })();
  }, []);

  if (done || !needsNudge) return null;

  const openMiniApps = async () => {
    try {
      await sdk.actions.openUrl("https://warpcast.com/~/mini-apps");
    } catch {}
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 rounded-xl bg-[#101525] border border-white/10 p-4 shadow-lg">
      <div className="text-sm">
        <b>Enable Daily Reminder</b><br />
        Aktifkan notifikasi untuk BaseTC supaya dapat pengingat klaim jam 07:00 WIB.
        Jika dulu sudah enable, lakukan <i>Disable → Enable</i> lagi agar token terdaftar.
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={openMiniApps}
          className="px-3 py-2 rounded-lg bg-[#2b7bff] text-white text-sm active:scale-95"
        >
          Open Mini Apps
        </button>
        <button
          onClick={() => setNeedsNudge(false)}
          className="ml-auto px-3 py-2 rounded-lg bg-white/5 text-white text-sm active:scale-95"
        >
          Close
        </button>
      </div>
    </div>
  );
}

