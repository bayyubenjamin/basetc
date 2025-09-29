// app/context/FarcasterProvider.tsx
//
// Alasan Perbaikan Final: Memperbaiki semua error build dan masalah logika.
// 1. Memperbaiki syntax error `const = useState(false)`.
// 2. Menambahkan useEffect baru yang akan memanggil API `/api/user` untuk mengambil data profil
//    (nama, pfp) SETELAH FID berhasil didapatkan, baik secara otomatis maupun manual.
//    Ini menyelesaikan masalah profil kosong saat FID di-input manual.
"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import FidInput from "../components/FidInput";

const DEBUG_MODE = true;

type FarcasterUser = {
  fid: number | null;
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

async function getFarcasterContext(): Promise<any> {
  if (typeof window !== 'undefined' && window.self === window.top) {
    if (DEBUG_MODE) console.info("[FarcasterProvider] Not in an iframe, skipping SDK check.");
    return null;
  }
  try {
    const mod = await import("@farcaster/miniapp-sdk");
    const { sdk } = mod;
    for (let i = 0; i < 10; i++) {
      const context = await sdk.context;
      if (context?.user?.fid) {
        if (DEBUG_MODE) console.log(`[FarcasterProvider] Context found on attempt ${i + 1}`, context);
        return { user: context.user };
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    if (DEBUG_MODE) console.warn("[FarcasterProvider] SDK present but no context found after retries.");
    return null;
  } catch (err: any) {
    if (DEBUG_MODE) console.warn("[FarcasterProvider] Mini-app SDK not found or failed to load.");
    return null;
  }
}

export function FarcasterProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FarcasterUser | null>(null);
  const [fid, setFidState] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInFrame, setIsInFrame] = useState(false);

  const setFidManually = useCallback((newFid: number) => {
    if (DEBUG_MODE) console.log(`[FarcasterProvider] Manually setting FID: ${newFid}`);
    localStorage.setItem("basetc_fid", String(newFid));
    setFidState(newFid);
  }, []);

  // Effect #1: Resolve FID from any source (A, B, C, D)
  useEffect(() => {
    let isCancelled = false;
    const resolveFid = async () => {
      if (DEBUG_MODE) console.log("[FarcasterProvider] Starting FID resolution...");
      setLoading(true);

      // A. Frame Context
      const context = await getFarcasterContext();
      if (!isCancelled && context?.user?.fid) {
        if (DEBUG_MODE) console.log("[FarcasterProvider] Priority A: Resolved via Frame Context.", context.user);
        setIsInFrame(true);
        localStorage.setItem("basetc_fid", String(context.user.fid));
        setFidState(context.user.fid); // This will trigger Effect #2
        return;
      }

      // B. URL Query Param
      const url = new URL(window.location.href);
      const fidFromUrl = url.searchParams.get("fid");
      if (!isCancelled && fidFromUrl && /^\d+$/.test(fidFromUrl)) {
        const parsedFid = parseInt(fidFromUrl, 10);
        if (DEBUG_MODE) console.log(`[FarcasterProvider] Priority B: Resolved via URL param ?fid=${parsedFid}`);
        localStorage.setItem("basetc_fid", String(parsedFid));
        setFidState(parsedFid); // This will trigger Effect #2
        return;
      }

      // C. LocalStorage
      const fidFromStorage = localStorage.getItem("basetc_fid");
      if (!isCancelled && fidFromStorage && /^\d+$/.test(fidFromStorage)) {
        const parsedFid = parseInt(fidFromStorage, 10);
        if (DEBUG_MODE) console.log(`[FarcasterProvider] Priority C: Resolved via localStorage: ${parsedFid}`);
        setFidState(parsedFid); // This will trigger Effect #2
        return;
      }
      
      // D. Fallback (no FID found)
      if (!isCancelled) {
        if (DEBUG_MODE) console.warn("[FarcasterProvider] Priority D: No FID found. Awaiting manual input.");
        setLoading(false);
      }
    };
    resolveFid();
    return () => { isCancelled = true; };
  }, []);

  // Effect #2: Fetch user data whenever FID is resolved
  useEffect(() => {
    if (!fid) return;

    const fetchUserData = async () => {
      if (DEBUG_MODE) console.log(`[FarcasterProvider] FID is set to ${fid}, fetching user data...`);
      setLoading(true);
      try {
        const res = await fetch(`/api/user?fid=${fid}`);
        if (!res.ok) throw new Error("User not found or API error");
        const data = await res.json();
        
        if (data && data.fid) {
           if (DEBUG_MODE) console.log("[FarcasterProvider] User data fetched successfully:", data);
           setUser({
            fid: data.fid,
            username: data.username,
            displayName: data.display_name,
            pfpUrl: data.pfp_url,
          });
        } else {
            throw new Error("Invalid user data received");
        }
      } catch (e: any) {
        if (DEBUG_MODE) console.error("[FarcasterProvider] Failed to fetch user data, using fallback.", e.message);
        setUser({ fid, username: `fid:${fid}`, displayName: `User ${fid}`, pfpUrl: null });
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [fid]);

  const value = { user, fid, loading, error, isInFrame, setFid: setFidManually };

  return (
    <FarcasterContext.Provider value={value}>
      {loading ? (
        <div className="flex items-center justify-center min-h-screen bg-neutral-950">
          <p className="text-neutral-400 animate-pulse">Initializing BaseTC...</p>
        </div>
      ) : !fid ? (
        <FidInput setFid={setFidManually} />
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


