"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export const dynamic = "force-dynamic"; // cegah error prerender

// Universal Link MiniApp resmi (punyamu)
const UNIVERSAL_LINK = "https://farcaster.xyz/miniapps/PkHG0AuDhXrd/basetc-console";
const FARCASTER_HINTS = ["Warpcast", "Farcaster", "V2Frame"];

function Redirector() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const ua = navigator.userAgent || "";
    const isFarcaster = FARCASTER_HINTS.some((k) => ua.includes(k));
    const forceWeb = searchParams.get("web") === "1"; // debug bypass

    const ref = searchParams.get("ref");
    const fid = searchParams.get("fid");
    const queryString = window.location.search; // bawa semua param

    if (isFarcaster) {
      // 🚀 Kalau dari Farcaster → lempar ke /launch + param (supaya referral tetap terbawa)
      router.replace("/launch" + queryString);
      return;
    }

    if (forceWeb) {
      // 👨‍💻 Debug manual di browser tanpa redirect
      return;
    }

    // 🌐 Kalau dari browser biasa → lempar ke Universal Link Farcaster
    const url = new URL(UNIVERSAL_LINK);
    if (ref) url.searchParams.set("ref", ref);
    if (fid) url.searchParams.set("fid", fid);

    window.location.replace(url.toString());
  }, [router, searchParams]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        fontFamily: "system-ui, sans-serif",
        color: "#fff",
        background: "#000",
      }}
    >
      <div>Redirecting…</div>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            fontFamily: "system-ui, sans-serif",
            color: "#fff",
            background: "#000",
          }}
        >
          <div>Loading…</div>
        </main>
      }
    >
      <Redirector />
    </Suspense>
  );
}
