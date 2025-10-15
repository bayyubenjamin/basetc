// app/components/BackfillNotification.tsx
"use client";
import { useEffect } from "react";
import { sdk } from "@farcaster/miniapp-sdk";

/**
 * Silent backfill:
 * - Saat /launch dibuka, baca sdk.context.
 * - Jika ada notificationDetails (url+token), POST ke /api/notifications/upsert.
 * - Tidak menampilkan UI sama sekali.
 */
export default function BackfillNotification() {
  useEffect(() => {
    (async () => {
      try {
        const ctx = await sdk.context;

        // Hindari masalah typing antar versi SDK
        const anyCtx = ctx as any;
        const fid = Number(anyCtx?.user?.fid || 0);

        // Bentuk umum yang pernah muncul:
        // - anyCtx.client.notificationDetails
        // - anyCtx.notificationDetails
        const nd =
          anyCtx?.client?.notificationDetails ??
          anyCtx?.notificationDetails ??
          null;

        if (fid > 0 && nd?.url && nd?.token) {
          await fetch("/api/notifications/upsert", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fid,
              url: String(nd.url),
              token: String(nd.token),
            }),
          }).catch(() => {});
        }
      } catch {
        // diamkan saja—silent
      }
    })();
  }, []);

  return null; // no UI
}

