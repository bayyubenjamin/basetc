// app/page.tsx
"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccount } from "wagmi";

export const dynamic = "force-dynamic";

// [UPDATE] Helper untuk Loading Text animasi
const BOOT_LOGS = [
  "Initializing BaseTC Console...",
  "Loading assets...",
  "Syncing with Base Chain...",
  "Verifying cryptographic proofs...",
  "Establishing secure connection..."
];

const ALLOWED_CLIENTS = ["Warpcast", "Farcaster", "V2Frame", "Coinbase", "Ethereum", "Base"];

function LoadingScreen() {
    // State untuk animasi teks loading
    const [logIndex, setLogIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setLogIndex((prev) => (prev + 1) % BOOT_LOGS.length);
        }, 800); // Ganti teks setiap 800ms
        return () => clearInterval(interval);
    }, []);

    return (
        <main className="grid min-h-dvh place-items-center bg-zinc-950 text-white font-mono">
            <div className="flex flex-col items-center gap-6">
                {/* Logo atau Spinner dengan efek pulse */}
                <div className="relative h-16 w-16">
                    <div className="absolute inset-0 rounded-full border-4 border-indigo-500/30 animate-ping"></div>
                    <div className="relative h-full w-full rounded-full border-4 border-t-indigo-500 border-r-transparent border-b-indigo-500 border-l-transparent animate-spin"></div>
                </div>
                
                {/* Text Boot Sequence */}
                <div className="flex flex-col items-center gap-1 h-12">
                     <p className="text-sm font-bold tracking-widest text-indigo-400 uppercase animate-pulse">
                        {BOOT_LOGS[logIndex]}
                    </p>
                    <p className="text-xs text-zinc-500">
                        Please wait...
                    </p>
                </div>
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
    const { isConnected } = useAccount(); 
    const [isAllowed, setIsAllowed] = useState(false);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        const checkEnvironment = () => {
            const ua = navigator.userAgent || "";
            
            // 1. Cek User Agent 
            const isKnownClient = ALLOWED_CLIENTS.some((k) => ua.includes(k));

            // 2. Cek Wallet Provider
            // @ts-ignore
            const hasWallet = typeof window !== "undefined" && window.ethereum !== undefined;

            if (isKnownClient || hasWallet || isConnected) {
                setIsAllowed(true);
                const params = searchParams.toString();
                router.replace(`/launch${params ? `?${params}` : ""}`);
            } else {
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
