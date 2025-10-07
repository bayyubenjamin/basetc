// app/page.tsx
"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

const UNIVERSAL_LINK = "https://farcaster.xyz/miniapps/PkHG0AuDhXrd/basetc-console";
const FARCASTER_HINTS = ["Warpcast", "Farcaster", "V2Frame"];

function LoadingScreen() {
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
      }}
    >
      <p style={{ opacity: 0.8 }}>Redirecting to Farcaster App...</p>
    </main>
  );
}

function Landing() {
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
      }}
    >
      <div style={{ maxWidth: 640, width: "100%", textAlign: "center" }}>
        <img
          src="/img/logo.png"
          alt="BaseTC"
          width={96}
          height={96}
          style={{ display: "block", margin: "0 auto 16px" }}
        />
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>BaseTC Console</h1>
        <p style={{ opacity: 0.8, marginBottom: 20 }}>
          Farcaster Mini App untuk mining console di Base. Buka lewat Farcaster untuk pengalaman penuh.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a
            href={`warpcast://open-miniapp?url=${encodeURIComponent("https://basetc.xyz/launch")}`}
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
          <a
            href="/launch?web=1"
            style={{
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid #333",
              color: "#fff",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Open Web Preview
          </a>
        </div>
        <p style={{ opacity: 0.6, marginTop: 12, fontSize: 12 }}>
          Tip: bagikan referral seperti <code>https://basetc.xyz?fidref=...</code> — akan otomatis terbuka di Farcaster.
        </p>
      </div>
    </main>
  );
}


function RootContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const hasReferral = useMemo(() => {
    const ref = searchParams.get("ref");
    const fid = searchParams.get("fid");
    const fidref = searchParams.get("fidref");
    return Boolean(ref || fid || fidref);
  }, [searchParams]);

  useEffect(() => {
    // Jalankan hanya jika ada parameter referral
    if (!hasReferral) return;

    const ua = navigator.userAgent || "";
    const isFarcasterClient = FARCASTER_HINTS.some((k) => ua.includes(k));

    if (isFarcasterClient) {
      // Jika sudah di dalam Farcaster, langsung navigasi ke /launch
      router.replace(`/launch?${searchParams.toString()}`);
      return;
    }

    // Jika di browser, alihkan ke Universal Link dengan membawa parameter
    const redirectUrl = new URL(UNIVERSAL_LINK);
    redirectUrl.search = searchParams.toString();
    window.location.replace(redirectUrl.toString());

  }, [router, searchParams, hasReferral]);

  if (hasReferral) {
    return <LoadingScreen />;
  }

  // Jika tidak ada referral, tampilkan halaman landing biasa
  return <Landing />;
}

export default function Home() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <RootContent />
    </Suspense>
  );
}
