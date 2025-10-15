"use client";
import { useEffect } from "react";
import { MiniApp } from "@farcaster/miniapp-sdk";

export default function NotificationsGate() {
  useEffect(() => {
    (async () => {
      try {
        const perm = await MiniApp.notifications.getPermission();
        if (perm !== "granted") {
          await MiniApp.notifications.requestPermission();
        }
        // Kalau kampanye kamu pakai topic, samain di sini:
        await MiniApp.notifications.subscribe({ topic: "broadcast" });
      } catch (e) {
        console.error("notif gate:", e);
      }
    })();
  }, []);
  return null;
}

