// app/page.tsx
"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

// Universal Link Farcaster Anda
const UNIVERSAL_LINK = "https://farcaster.xyz/miniapps/PkHG0AuDhXrd/basetc-console";
const FARCASTER_HINTS = ["Warpcast", "Farcaster", "V2Frame"];

// Komponen Loading Sederhana
function LoadingScreen() {
  return (
    <main style={{ minHeight: "100dvh", background: "#0b0b0b", color: "#fff", display: "grid", placeItems: "center" }}>
      <p style={{ opacity: 0.8 }}>Loading BaseTC Console...</p>
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

  const hasReferral = useMemo(() => {
    return searchParams.has("ref") || searchParams.has("fid") || searchParams.has("fidref");
  }, [searchParams]);

  useEffect(() => {
    const ua = navigator.userAgent || "";
    const isFarcasterClient = FARCASTER_HINTS.some((k) => ua.includes(k));
    const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);

    // KASUS 1: Dibuka di dalam Klien Farcaster
    // Langsung arahkan ke /launch dengan semua parameter yang ada.
    if (isFarcasterClient) {
      const params = searchParams.toString();
      router.replace(`/launch${params ? `?${params}` : ""}`);
      return;
    }

    // KASUS 2: Dibuka di browser mobile (Chrome, Safari) dengan link referral
    // Lakukan redirect ke Universal Link untuk membuka aplikasi native.
    if (isMobile && hasReferral) {
      const redirectUrl = new URL(UNIVERSAL_LINK);
      redirectUrl.search = searchParams.toString();
      window.location.replace(redirectUrl.toString());
      return;
    }
    
    // KASUS 3: Dibuka di browser desktop atau mobile tanpa referral
    // Biarkan di halaman ini (akan menampilkan LandingPage).
    // Jika Anda ingin semua pengguna mobile dipaksa redirect, hapus '&& hasReferral' di atas.

  }, [router, searchParams, hasReferral]);
  
  // Selama proses pengecekan atau redirect, tampilkan loading.
  // Jika tidak ada kondisi yang terpenuhi (misal: desktop), LandingPage akan tampil setelahnya.
  return <LandingPage />;
}

export default function Home() {
  // Gunakan Suspense untuk memastikan useSearchParams bekerja dengan baik
  return (
    <Suspense fallback={<LoadingScreen />}>
      <RootHandler />
    </Suspense>
  );
}
