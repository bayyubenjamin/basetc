// app/page.tsx
"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Ticker from "./components/Ticker"; // <-- DITAMBAH: import Ticker

export const dynamic = "force-dynamic";

const FARCASTER_HINTS = ["Warpcast", "Farcaster", "V2Frame"];

function LoadingScreen() {
    return (
        <>
            <Ticker /> {/* <-- DITAMBAH: tampil di loading landing */}
            <main style={{ minHeight: "100vh", background: "#0b0b0b", color: "#fff", display: "grid", placeItems: "center" }}>
                <p style={{ opacity: 0.8 }}>Loading BaseTC Console...</p>
            </main>
        </>
    );
}

function LandingPage() {
    return (
        <>
            <Ticker /> {/* <-- DITAMBAH: tampil di landing desktop */}
            <main style={{ minHeight: "100dvh", background: "#0b0b0b", color: "#fff", display: "grid", placeItems: "center", padding: "24px", textAlign: "center" }}>
                <div>
                    <img src="/img/logo.png" alt="BaseTC" width={96} height={96} style={{ margin: "0 auto 16px" }} />
                    <h1 style={{ fontSize: 28, marginBottom: 8 }}>BaseTC Console</h1>
                    <p style={{ opacity: 0.8, marginBottom: 20 }}>This is a Farcaster Mini App. Please open it within a Farcaster client like Warpcast.</p>
                    <a href="https://farcaster.xyz/miniapps/PkHG0AuDhXrd/basetc-console" style={{ padding: "12px 16px", borderRadius: 12, background: "#6EE7FF", color: "#000", textDecoration: "none", fontWeight: 600 }}>
                        Open in Farcaster
                    </a>
                </div>
            </main>
        </>
    );
}

function RootHandler() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const ua = navigator.userAgent || "";
        const isFarcasterClient = FARCASTER_HINTS.some((k) => ua.includes(k));

        // Jika terdeteksi di dalam Farcaster, pastikan pengguna berada di /launch
        if (isFarcasterClient) {
            const params = searchParams.toString();
            router.replace(`/launch${params ? `?${params}` : ""}`);
        }
    }, [router, searchParams]);

    // Middleware sudah menangani redirect untuk mobile.
    // Jadi, jika kode ini berjalan, berarti kita di desktop atau sudah di dalam Farcaster.
    // Jika di dalam Farcaster, akan segera di-redirect ke /launch.
    // Jika di desktop, tampilkan LandingPage.
    const ua = (typeof window !== 'undefined') ? navigator.userAgent : "";
    const isFarcasterClient = FARCASTER_HINTS.some((k) => ua.includes(k));

    if (isFarcasterClient) {
        return <LoadingScreen />;
    }

    return <LandingPage />;
}

export default function Home() {
    return (
        <Suspense fallback={<LoadingScreen />}>
            <RootHandler />
        </Suspense>
    );
}