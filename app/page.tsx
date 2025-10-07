// app/page.tsx
"use client";

import { Suspense, useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

// Universal Link MiniApp Anda
const UNIVERSAL_LINK = "https://farcaster.xyz/miniapps/PkHG0AuDhXrd/basetc-console";
const FARCASTER_HINTS = ["Warpcast", "Farcaster", "V2Frame"];

// Komponen Halaman Landing (Welcome Page)
function LandingPage() {
  const searchParams = useSearchParams();
  
  // Buat tautan "Open" yang dinamis, yang akan membawa serta semua parameter referral
  const openLink = useMemo(() => {
    const redirectUrl = new URL(UNIVERSAL_LINK);
    redirectUrl.search = searchParams.toString();
    return redirectUrl.toString();
  }, [searchParams]);

  return (
    <main
      style={{
        minHeight: "100dvh",
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
          This is a Farcaster Mini App. Click below to open it in your Farcaster client.
        </p>
        <a
          href={openLink} // Gunakan tautan dinamis di sini
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

// Komponen utama yang akan menentukan apa yang harus ditampilkan
function RootHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isFarcasterClient, setIsFarcasterClient] = useState(false);
  const [isCheckComplete, setIsCheckComplete] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent || "";
    const isFarcaster = FARCASTER_HINTS.some((k) => ua.includes(k));
    setIsFarcasterClient(isFarcaster);
    setIsCheckComplete(true);

    if (isFarcaster) {
      const queryString = searchParams.toString();
      router.replace(`/launch${queryString ? `?${queryString}` : ""}`);
    }
  }, [router, searchParams]);

  if (!isCheckComplete) {
      // Selama pengecekan awal, tampilkan loading
      return (
          <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0b0b0b", color: "white" }}>
              <p>Loading...</p>
          </main>
      );
  }

  // Jika sudah di dalam Farcaster, tampilkan loading selagi redirect internal ke /launch
  if (isFarcasterClient) {
      return (
          <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0b0b0b", color: "white" }}>
              <p>Opening Mini App...</p>
          </main>
      );
  }

  // Jika di browser biasa, tampilkan halaman landing
  return <LandingPage />;
}

export default function Home() {
  return (
    <Suspense fallback={
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0b0b0b", color: "white" }}>
            <p>Loading...</p>
        </main>
    }>
      <RootHandler />
    </Suspense>
  );
}
