"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const callReadyThenRedirect = async () => {
      const withTimeout = <T,>(p: Promise<T>, ms = 1500) =>
        Promise.race([
          p,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
        ]);

      try {
        const mod = await import("@farcaster/miniapp-sdk").catch(() => null);
        const sdk = mod?.sdk;

        if (sdk?.actions?.ready) {
          try {
            await withTimeout(sdk.actions.ready());
          } catch {
          }
        }
      } catch {
      } finally {
        router.replace("/launch");
      }
    };

    void callReadyThenRedirect();
  }, [router]);

  return null;
}

