// app/page.tsx
"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

export const dynamic = "force-dynamic";

// Universal Link Farcaster Anda
const UNIVERSAL_LINK = "https://farcaster.xyz/miniapps/PkHG0AuDhXrd/basetc-console";
const FARCASTER_HINTS = ["Warpcast", "Farcaster", "V2Frame"];

// Komponen Loading Sederhana
function LoadingScreen({ message }: { message: string }) {
  return (
    <main style={{ minHeight: "100dvh", background: "#0b0b0b", color: "#fff", display: "grid", placeItems: "center" }}>
      <p style={{ opacity: 0.8 }}>{message}</p>
    </main>
  );
}

// Komponen Landing Page (jika dibuka di browser desktop tanpa referral)
function LandingPage() {
  return (
    <main style={{ minHeight: "100dvh", background: "#0b0b0b", color: "#fff", display: "grid", placeItems: "center", padding: "24px", textAlign: "center" }}>
      <div>
        <img src="/img/logo.png" alt="BaseTC" width={96} height={96} style={{ margin: "0 auto 16px" }} />
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>BaseTC Console</h1>
        <p style={{ opacity: 0.8, marginBottom: 20 }}>This is a Farcaster Mini App. Please open it within a Farcaster client like Warpcast.</p>
        <a href={UNIVERSAL_LINK} style={{ padding: "12px 16px", borderRadius: 12, background: "#6EE7FF", color: "#000", textDecoration: "none", fontWeight: 600 }}>
          Open in Farcaster
        </a>
      </div>
    </main>
  );
}

function RootHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  useEffect(() => {
    // Jalankan logika hanya di sisi client
    if (typeof window === 'undefined') return;

    const ua = navigator.userAgent || "";
    const isFarcasterClient = FARCASTER_HINTS.some((k) => ua.includes(k));
    const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
    const params = searchParams.toString();

    // KASUS 1: Jika sudah berada di dalam Klien Farcaster.
    // Tugasnya adalah memastikan pengguna berada di /launch.
    if (isFarcasterClient) {
      if (pathname !== "/launch") {
        router.replace(`/launch${params ? `?${params}` : ""}`);
      }
      return; // Hentikan eksekusi lebih lanjut
    }
      
    // KASUS 2: Jika berada di browser mobile.
    // Kita HARUS mengalihkannya ke Universal Link untuk mencoba membuka aplikasi native.
    if (isMobile) {
      const redirectUrl = new URL(UNIVERSAL_LINK);
      redirectUrl.search = params; // Salin semua parameter referral
      window.location.replace(redirectUrl.toString());
      return; // Hentikan eksekusi, biarkan loading screen tampil
    }

    // KASUS 3: Jika di browser desktop.
    // Biarkan saja, tampilkan LandingPage.
    // Jika Anda ingin redirect juga, Anda bisa memodifikasi logika di sini.

  }, [router, searchParams, pathname]);
  
  // Tampilkan LandingPage sebagai default jika tidak ada kondisi redirect yang terpenuhi (misal, di desktop)
  // Atau tampilkan LoadingScreen jika redirect sedang diproses (useEffect akan berjalan dan mengalihkan)
  const ua = (typeof window !== 'undefined') ? navigator.userAgent : "";
  const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
  const isFarcasterClient = FARCASTER_HINTS.some((k) => ua.includes(k));

  if (!isFarcasterClient && isMobile) {
      return <LoadingScreen message="Redirecting to Farcaster App..." />;
  }

  return <LandingPage />;
}

export default function Home() {
  return (
    <Suspense fallback={<LoadingScreen message="Loading..." />}>
      <RootHandler />
    </Suspense>
  );
}
