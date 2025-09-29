// app/context/FarcasterProvider.tsx
//
// Alasan Perbaikan: Mengatasi masalah "stuck on initializing".
// Fungsi getFarcasterContext ditulis ulang agar gagal dengan cepat (fail-fast) saat tidak berada
// dalam environment Farcaster, dengan menambahkan pengecekan iframe dan penanganan error yang lebih baik.
// Ini memastikan alur resolusi FID selalu selesai dan tidak menggantung.
"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import FidInput from "../components/FidInput"; // Komponen fallback UI

// Aktifkan untuk melihat log proses resolusi FID di console browser
const DEBUG_MODE = true;

type FarcasterUser = {
  fid: number;
  username: string | null;
  displayName: string | null;
  pfpUrl: string | null;
};

type FarcasterContextType = {
  user: FarcasterUser | null;
  fid: number | null;
  loading: boolean;
  error: string | null;
  isInFrame: boolean;
  setFid: (fid: number) => void;
};

const FarcasterContext = createContext<FarcasterContextType | undefined>(
  undefined
);

// --- FUNGSI YANG DIPERBAIKI ---
// Dibuat lebih robust untuk menangani environment non-Farcaster.
async function getFarcasterContext(): Promise<any> {
  // 1. Pengecekan cepat: Jika tidak di dalam iframe, anggap bukan Farcaster App.
  if (typeof window !== 'undefined' && window.self === window.top) {
    if (DEBUG_MODE) console.info("[FarcasterProvider] Not in an iframe, skipping SDK check.");
    return null;
  }

  try {
    // 2. Dynamic import dibungkus try-catch, jika SDK tidak ada, langsung fallback.
    const mod = await import("@farcaster/miniapp-sdk");
    const { sdk } = mod;

    // 3. Polling singkat untuk context, karena bisa jadi belum siap.
    for (let i = 0; i < 10; i++) { // Coba selama 2 detik (10 * 200ms)
        const context = sdk.getContext();
        if (context?.fid) {
            if (DEBUG_MODE) console.log(`[FarcasterProvider] Context found on attempt ${i + 1}`, context);
            // Normalisasi output agar konsisten
            return {
                user: {
                    fid: context.fid,
                    username: context.username,
                    displayName: context.displayName,
                    pfpUrl: context.pfpUrl,
                }
            };
        }
        await new Promise((r) => setTimeout(r, 200));
    }

    if (DEBUG_MODE) console.warn("[FarcasterProvider] SDK present but no context found after retries.");
    return null;

  } catch (err: any) {
    if (DEBUG_MODE) console.warn("[FarcasterProvider] Mini-app SDK not found or failed to load. Likely not in a Farcaster app.");
    return null;
  }
}

export function FarcasterProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FarcasterUser | null>(null);
  const [fid, setFidState] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInFrame, setIsInFrame] = useState(false);

  const setFid = useCallback((newFid: number) => {
    if (DEBUG_MODE) console.log(`[FarcasterProvider] Manually setting FID: ${newFid}`);
    localStorage.setItem("basetc_fid", String(newFid));
    // Buat data user placeholder saat FID di-set manual
    setUser({
      fid: newFid,
      username: `fid:${newFid}`,
      displayName: `User ${newFid}`,
      pfpUrl: null,
    });
    setFidState(newFid);
  }, []);

  useEffect(() => {
    let isCancelled = false;
    const resolveFid = async () => {
      if (DEBUG_MODE) console.log("[FarcasterProvider] Starting FID resolution...");
      setLoading(true);

      // A. Frame Context (Highest priority) - Sekarang dengan fungsi yang lebih aman
      const context = await getFarcasterContext();
      if (!isCancelled && context?.user?.fid) {
        if (DEBUG_MODE) console.log("[FarcasterProvider] Priority A: Resolved via Frame Context.", context.user);
        setUser(context.user);
        setFidState(context.user.fid);
        localStorage.setItem("basetc_fid", String(context.user.fid));
        setIsInFrame(true);
        setLoading(false); // <-- Ini akan terpanggil
        return;
      }

      if (DEBUG_MODE && !isCancelled) console.info("[FarcasterProvider] Context not found, proceeding to fallbacks.");

      // B. URL Query Param
      try {
        const url = new URL(window.location.href);
        const fidFromUrl = url.searchParams.get("fid");
        if (!isCancelled && fidFromUrl && /^\d+$/.test(fidFromUrl)) {
          const parsedFid = parseInt(fidFromUrl, 10);
          if (DEBUG_MODE) console.log(`[FarcasterProvider] Priority B: Resolved via URL param ?fid=${parsedFid}`);
          setFid(parsedFid);
          setLoading(false); // <-- Ini akan terpanggil
          return;
        }
      } catch {}

      // C. LocalStorage
      const fidFromStorage = localStorage.getItem("basetc_fid");
      if (!isCancelled && fidFromStorage && /^\d+$/.test(fidFromStorage)) {
        const parsedFid = parseInt(fidFromStorage, 10);
        if (DEBUG_MODE) console.log(`[FarcasterProvider] Priority C: Resolved via localStorage: ${parsedFid}`);
        setFid(parsedFid);
        setLoading(false); // <-- Ini akan terpanggil
        return;
      }

      // D. Fallback (no FID found)
      if (!isCancelled) {
        if (DEBUG_MODE) console.warn("[FarcasterProvider] Priority D: No FID found. Awaiting manual input.");
        setLoading(false); // <-- Ini juga akan terpanggil jika semua gagal
      }
    };

    resolveFid();
    return () => { isCancelled = true; };
  }, [setFid]);

  const value = { user, fid, loading, error, isInFrame, setFid };

  return (
    <FarcasterContext.Provider value={value}>
      {loading ? (
        <div className="flex items-center justify-center min-h-screen bg-neutral-950">
          <p className="text-neutral-400 animate-pulse">Initializing BaseTC...</p>
        </div>
      ) : !fid ? ( // Disederhanakan: jika tidak ada FID, tampilkan input
        <FidInput setFid={setFid} />
      ) : (
        children
      )}
    </FarcasterContext.Provider>
  );
}

export function useFarcaster(): FarcasterContextType {
  const context = useContext(FarcasterContext);
  if (context === undefined) {
    throw new Error("useFarcaster must be used within a FarcasterProvider");
  }
  return context;
}

