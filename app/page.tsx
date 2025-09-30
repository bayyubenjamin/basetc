"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Root page untuk Farcaster Mini App.
 * - Memanggil sdk.actions.ready() setelah mount (dengan timeout fallback)
 * - Lalu redirect ke /dashboard
 * - Tetap memanggil ready() walaupun import SDK gagal, supaya splash ditutup
 */
export default function Page() {
  const router = useRouter();
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const callReadyThenRedirect = async () => {
      // Helper: timeout agar splash tetap ditutup walau ada kendala
      const withTimeout = <T,>(p: Promise<T>, ms = 1500) =>
        Promise.race([
          p,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
        ]);

      try {
        // Import dinamis untuk menghindari masalah SSR
        const mod = await import("@farcaster/miniapp-sdk").catch(() => null);
        const sdk = mod?.sdk;

        // Jika SDK tersedia, panggil ready() dengan timeout fallback
        if (sdk?.actions?.ready) {
          try {
            await withTimeout(sdk.actions.ready());
          } catch {
            // Abaikan: kalau ready gagal, tetap lanjut redirect agar tidak nyangkut di splash
          }
        }
      } catch {
        // Abaikan error import; tetap lanjut redirect
      } finally {
        // Selalu arahkan ke dashboard agar sesuai homeUrl baru
        router.replace("/dashboard");
      }
    };

    void callReadyThenRedirect();
  }, [router]);

  // Tidak perlu UI—host Farcaster menampilkan splash hingga ready() dipanggil
  return null;
}

