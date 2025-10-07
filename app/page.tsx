// app/page.tsx
"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

// Universal Link MiniApp resmi Anda
const UNIVERSAL_LINK = "https://farcaster.xyz/miniapps/PkHG0AuDhXrd/basetc-console";
const FARCASTER_HINTS = ["Warpcast", "Farcaster", "V2Frame"];

function Redirector() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Jalankan hanya di sisi client
    if (typeof window === 'undefined') return;

    const ua = navigator.userAgent || "";
    const isFarcaster = FARCASTER_HINTS.some((k) => ua.includes(k));
    const forceWeb = searchParams.get("web") === "1";
    
    // --- PERBAIKAN DI SINI ---
    // Ambil semua parameter yang ada di URL saat ini, bukan hanya 'ref' dan 'fid'
    const queryString = window.location.search; 

    // Jika dibuka di dalam klien Farcaster, arahkan ke halaman /launch
    if (isFarcaster) {
      router.replace(`/launch${queryString}`);
      return;
    }

    // Jika mode debug web, jangan lakukan apa-apa
    if (forceWeb) {
      // Arahkan ke /launch jika pengguna secara eksplisit meminta mode web
      // Ini agar pengguna tidak terjebak di halaman redirect kosong
      router.replace(`/launch${queryString}`);
      return;
    }

    // Jika dibuka di browser biasa (bukan Farcaster), alihkan ke Universal Link
    const redirectUrl = new URL(UNIVERSAL_LINK);
    // Tempelkan semua parameter yang ada ke Universal Link
    redirectUrl.search = queryString;

    window.location.replace(redirectUrl.toString());

  }, [router, searchParams]);

  // Tampilan loading universal
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        fontFamily: "system-ui, sans-serif",
        color: "#fff",
        background: "#0b0b0b", // Warna latar yang konsisten
      }}
    >
      <p>Redirecting to BaseTC Console...</p>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif", color: "#fff", background: "#0b0b0b" }}>
        <p>Loading...</p>
      </main>
    }>
      <Redirector />
    </Suspense>
  );
}
