// app/page.tsx
"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccount } from "wagmi";

export const dynamic = "force-dynamic";

// [BARU] Daftar browser yang diizinkan, termasuk lingkungan Base/Coinbase
const ALLOWED_CLIENTS = ["Warpcast", "Farcaster", "V2Frame", "Coinbase", "Ethereum", "Base"];

function LoadingScreen() {
    return (
        <main className="grid min-h-dvh place-items-center bg-zinc-950 text-white">
            <div className="flex flex-col items-center gap-4">
                <span className="loading loading-spinner loading-lg text-indigo-500"></span>
                <p className="opacity-80">Loading BaseTC Console...</p>
            </div>
        </main>
    );
}

function LandingPage() {
    return (
        <main className="grid min-h-dvh place-items-center bg-zinc-950 px-6 text-center text-white">
            <div className="max-w-md">
                <img src="/img/logo.png" alt="BaseTC" width={96} height={96} className="mx-auto mb-4" />
                <h1 className="mb-2 text-2xl font-bold">BaseTC Console</h1>
                <p className="mb-8 text-zinc-400">
                    Please open this Mini App within Warpcast or Base App.
                </p>
                <a href="https://farcaster.xyz/miniapps/PkHG0AuDhXrd/basetc-console" 
                   className="block w-full rounded-xl bg-[#6EE7FF] px-4 py-3 font-semibold text-black hover:bg-[#5CD6EF] transition">
                    Open in Farcaster
                </a>
            </div>
        </main>
    );
}

function RootHandler() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { isConnected } = useAccount(); // Cek status koneksi wallet
    const [isAllowed, setIsAllowed] = useState(false);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        const checkEnvironment = () => {
            const ua = navigator.userAgent || "";
            
            // 1. Cek User Agent (Apakah mengandung kata kunci Farcaster atau Base?)
            const isKnownClient = ALLOWED_CLIENTS.some((k) => ua.includes(k));

            // 2. Cek apakah ada Wallet Provider (Base App pasti punya window.ethereum)
            // @ts-ignore
            const hasWallet = typeof window !== "undefined" && window.ethereum !== undefined;

            // Jika SALAH SATU benar (Klien dikenal ATAU ada Wallet ATAU sudah connect), izinkan masuk
            if (isKnownClient || hasWallet || isConnected) {
                setIsAllowed(true);
                const params = searchParams.toString();
                // Redirect ke halaman launch
                router.replace(`/launch${params ? `?${params}` : ""}`);
            } else {
                // Jika browser biasa tanpa wallet, hentikan loading dan tampilkan Landing Page
                setChecking(false);
            }
        };

        checkEnvironment();
    }, [router, searchParams, isConnected]);

    if (isAllowed || checking) {
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
