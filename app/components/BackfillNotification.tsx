// app/components/BackfillNotification.tsx
"use client";
import { useEffect, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";

export default function BackfillNotification() {
  const [done, setDone] = useState(false);
  const [needsNudge, setNeedsNudge] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const ctx = await sdk.context;

        // Hindari masalah typing: beberapa versi SDK tidak expose 'client' di type.
        const anyCtx = ctx as any;
        const fid = Number(anyCtx?.user?.fid || 0);

        // Coba dua bentuk yang umum ditemui:
        // - anyCtx.client.notificationDetails
        // - anyCtx.notificationDetails
        const nd =
          anyCtx?.client?.notificationDetails ??
          anyCtx?.notificationDetails ??
          null;

        if (fid > 0 && nd?.url && nd?.token) {
          // Backfill ke server agar tercatat di Supabase
          await fetch("/api/notifications/upsert", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fid, url: String(nd.url), token: String(nd.token) }),
          });
          setDone(true);
          setNeedsNudge(false);
        } else {
          // Tidak ada token di context -> user belum enable notif
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
    <div className="fixed bottom-2 left-4 right-4 z-50 rounded-xl bg-[#101525] border border-white/10 p-4 shadow-lg">
      <div className="text-sm">
        <b>Enable Daily Reminder</b><br />
        Enable notifications for BaseTC to receive claim reminders at 7:00 a.m. WIB.
If you've already enabled them, do the following: <i>Disable → Enable</i> lagi agar token terdaftar.
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

