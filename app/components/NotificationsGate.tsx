"use client";

import { useEffect } from "react";
// ❌ import { MiniApp } from "@farcaster/miniapp-sdk";
// ✅ pakai namespace import
import * as MiniApp from "@farcaster/miniapp-sdk";

const TOPIC = "broadcast"; // samakan dengan audience di Neynar (atau kosongkan kalau tak pakai topic)

export default function NotificationsGate() {
  useEffect(() => {
    (async () => {
      try {
        // hindari crash di browser biasa
        const notif: any = (MiniApp as any)?.notifications;
        if (!notif || typeof notif.getPermission !== "function") return;

        const perm = await notif.getPermission();         // "granted" | "denied" | "prompt"
        if (perm !== "granted" && typeof notif.requestPermission === "function") {
          await notif.requestPermission();                // true kalau user mengizinkan
        }

        // subscribe (dengan/ tanpa topic)
        if (typeof notif.subscribe === "function") {
          if (TOPIC) {
            await notif.subscribe({ topic: TOPIC });
          } else {
            await notif.subscribe();
          }
        }
      } catch (e) {
        console.error("NotificationsGate error:", e);
      }
    })();
  }, []);

  return null;
}

