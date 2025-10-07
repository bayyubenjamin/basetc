// app/page.tsx
"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

const UNIVERSAL_LINK = "https://farcaster.xyz/miniapps/PkHG0AuDhXrd/basetc-console";
const FARCASTER_HINTS = ["Warpcast", "Farcaster", "V2Frame"];

// Komponen Halaman Landing (Welcome Page)
function LandingPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0b0b0b",
        color: "#fff",
        display: "grid",
        placeItems: "center",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        padding: "24px",
        textAlign: "center"
      }}
    >
      <div>
        <img
          src="/img/logo.png"
          alt="BaseTC"
          width={96}
          height={96}
          style={{ display: "block", margin: "0 auto 16px" }}
        />
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>Welcome to BaseTC Console</h1>
        <p style={{ opacity: 0.8, marginBottom: 20 }}>
          This is a Farcaster Mini App. Open it within a Farcaster client for the full experience.
        </p>
        <a
          href={UNIVERSAL_LINK}
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            background: "#6EE7FF",
            color: "#000",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Open in Farcaster
        </a>
      </div>
    </main>
  );
}

// Komponen Pengalih yang Cerdas
function Handler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const ua = navigator.userAgent || "";
    const isFarcasterClient = FARCASTER_HINTS.some((k) => ua.includes(k));
    const queryString = window.location.search;
    const hasParams = queryString.length > 1;

    // KASUS 1: Dibuka di dalam Farcaster.
    // Langsung arahkan ke /launch sambil membawa semua parameter.
    if (isFarcasterClient) {
      router.replace(`/launch${queryString}`);
      return;
    }

    // KASUS 2: Dibuka di browser biasa (bukan Farcaster) DAN memiliki parameter (ref, fidref, dll).
    // Ini adalah tautan referral yang perlu dialihkan.
    if (hasParams) {
      const redirectUrl = new URL(UNIVERSAL_LINK);
      redirectUrl.search = queryString; // Salin semua parameter
      window.location.replace(redirectUrl.toString());
      return;
    }

    // KASUS 3: Dibuka di browser biasa TANPA parameter.
    // Tidak perlu melakukan apa-apa, biarkan LandingPage ditampilkan.

  }, [router, searchParams]);

  // Tentukan apa yang harus ditampilkan berdasarkan kondisi awal
  if (typeof window !== 'undefined' && window.location.search.length > 1) {
    // Jika ada parameter, tampilkan loading selagi redirect
    return (
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0b0b0b", color: "white" }}>
            <p>Redirecting to Farcaster...</p>
        </main>
    );
  }

  // Jika tidak ada parameter, tampilkan halaman landing
  return <LandingPage />;
}

export default function Home() {
  return (
    <Suspense fallback={
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0b0b0b", color: "white" }}>
            <p>Loading...</p>
        </main>
    }>
      <Handler />
    </Suspense>
  );
}
