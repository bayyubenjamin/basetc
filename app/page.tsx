// app/page.tsx
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

// Universal Link MiniApp kamu (untuk browser biasa)
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
      <p style={{ opacity: 0.8 }}>Redirecting to Farcaster Mini App...</p>
    </main>
  );
}

function Landing() {
  // ... (Original Landing logic remains the same)
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
          {/* Buka di Farcaster (Universal Link) */}
          <a
            href="https://farcaster.xyz/miniapps/PkHG0AuDhXrd/basetc-console"
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

          {/* Buka versi web / debug */}
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
          Tip: bagikan referral seperti <code>https://basetc.xyz?ref=0x...&amp;fid=...</code> — akan otomatis terbuka di Farcaster.
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
    // Also check for 'fidref' if used in share link
    const fidref = searchParams.get("fidref");
    return Boolean(ref || fid || fidref);
  }, [searchParams]);

  useEffect(() => {
    if (!hasReferral) return;

    const ua = navigator.userAgent || "";
    const isFarcaster = FARCASTER_HINTS.some((k) => ua.includes(k));

    const ref = searchParams.get("ref");
    const fid = searchParams.get("fid");
    const fidref = searchParams.get("fidref");
    
    const redirectParams = window.location.search;

    if (isFarcaster) {
      // Dalam Farcaster → lempar ke /launch + param agar tracking referral tetap jalan
      router.replace("/launch" + redirectParams);
      return;
    }

    // Di browser → lempar ke Universal Link + referral (buka Farcaster)
    const url = new URL(UNIVERSAL_LINK);
    if (ref) url.searchParams.set("ref", ref);
    if (fid) url.searchParams.set("fid", fid);
    if (fidref) url.searchParams.set("fidref", fidref);
    
    // window.location.replace forces the browser to navigate immediately.
    window.location.replace(url.toString());
  }, [router, searchParams, hasReferral]);

  if (hasReferral) {
    // Tampilkan layar loading saat redirect sedang diproses (mencegah flicker Landing)
    return <LoadingScreen />;
  }

  return <Landing />;
}

export default function Home() {
  return (
    <Suspense fallback={<Landing />}>
      <RootContent />
    </Suspense>
  );
}
