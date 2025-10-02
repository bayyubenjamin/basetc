// app/page.jsx
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic";

// Universal Link MiniApp kamu (untuk browser biasa)
const UNIVERSAL_LINK = "https://farcaster.xyz/miniapps/PkHG0AuDhXrd/basetc-console";
const FARCASTER_HINTS = ["Warpcast", "Farcaster", "V2Frame"];

function RedirectIfReferral() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [didHandle, setDidHandle] = useState(false);

  const hasReferral = useMemo(() => {
    const ref = searchParams.get("ref");
    const fid = searchParams.get("fid");
    return Boolean(ref || fid);
  }, [searchParams]);

  useEffect(() => {
    if (didHandle || !hasReferral) return;

    const ua = navigator.userAgent || "";
    const isFarcaster = FARCASTER_HINTS.some((k) => ua.includes(k));

    const ref = searchParams.get("ref");
    const fid = searchParams.get("fid");

    if (isFarcaster) {
      // Dalam Farcaster → lempar ke /launch + param agar tracking referral tetap jalan
      router.replace("/launch" + window.location.search);
      setDidHandle(true);
      return;
    }

    // Di browser → lempar ke Universal Link + referral (buka Farcaster)
    const url = new URL(UNIVERSAL_LINK);
    if (ref) url.searchParams.set("ref", ref);
    if (fid) url.searchParams.set("fid", fid);
    window.location.replace(url.toString());
    setDidHandle(true);
  }, [router, searchParams, hasReferral, didHandle]);

  return null;
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
  return (
    <>
      {/* Redirect HANYA jika ada param referral */}
      <RedirectIfReferral />
      {/* Tanpa referral → tampil landing, TIDAK direct */}
      <Landing />
    </>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<Landing />}>
      <RootContent />
    </Suspense>
  );
}

