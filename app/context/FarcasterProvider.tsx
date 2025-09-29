// app/context/FarcasterProvider.tsx
//
// Alasan: Membuat satu sumber kebenaran (single source of truth) untuk FID dan konteks Farcaster.
// Provider ini mengimplementasikan strategi fallback A > B > C > D, menangani state loading,
// dan menyediakan data yang konsisten ke seluruh aplikasi untuk mencegah race condition.
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

// Helper function to robustly get Farcaster context with retry logic
async function getFarcasterContext(): Promise<any> {
  try {
    const mod = await import("@farcaster/miniapp-sdk");
    const { sdk }: any = mod;
    try {
      if (DEBUG_MODE) console.info("[FarcasterProvider] SDK ready action sent.");
      await sdk?.actions?.ready?.();
    } catch {}

    const tryGet = async () => {
      if (typeof sdk?.getContext === "function") return await sdk.getContext();
      const raw = sdk?.context;
      if (typeof raw === "function") return await raw.call(sdk);
      if (raw && typeof raw.then === "function") return await raw;
      return raw ?? null;
    };

    let ctx: any = null;
    for (let i = 0; i < 6; i++) {
      ctx = await tryGet();
      if (ctx?.user?.fid) {
        if (DEBUG_MODE) console.log(`[FarcasterProvider] Context found on attempt ${i + 1}`, ctx);
        return ctx;
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    if (DEBUG_MODE) console.warn("[FarcasterProvider] Could not get context after all retries.");
    return null;
  } catch (err: any) {
    if (DEBUG_MODE) console.error("[FarcasterProvider] Error importing or getting SDK context:", err.message);
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

      // A. Frame Context (Highest priority)
      const context = await getFarcasterContext();
      if (!isCancelled && context?.user?.fid) {
        if (DEBUG_MODE) console.log("[FarcasterProvider] Priority A: Resolved via Frame Context.", context.user);
        const farcasterUser = {
          fid: context.user.fid,
          username: context.user.username,
          displayName: context.user.displayName,
          pfpUrl: context.user.pfpUrl,
        };
        setUser(farcasterUser);
        setFidState(farcasterUser.fid);
        localStorage.setItem("basetc_fid", String(farcasterUser.fid));
        setIsInFrame(true);
        setLoading(false);
        return;
      }

      // B. URL Query Param
      try {
        const url = new URL(window.location.href);
        const fidFromUrl = url.searchParams.get("fid");
        if (!isCancelled && fidFromUrl && /^\d+$/.test(fidFromUrl)) {
          const parsedFid = parseInt(fidFromUrl, 10);
          if (DEBUG_MODE) console.log(`[FarcasterProvider] Priority B: Resolved via URL param ?fid=${parsedFid}`);
          setFid(parsedFid);
          setLoading(false);
          return;
        }
      } catch {}

      // C. LocalStorage
      const fidFromStorage = localStorage.getItem("basetc_fid");
      if (!isCancelled && fidFromStorage && /^\d+$/.test(fidFromStorage)) {
        const parsedFid = parseInt(fidFromStorage, 10);
        if (DEBUG_MODE) console.log(`[FarcasterProvider] Priority C: Resolved via localStorage: ${parsedFid}`);
        setFid(parsedFid);
        setLoading(false);
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
  }, [setFid]);

  const value = { user, fid, loading, error, isInFrame, setFid };

  return (
    <FarcasterContext.Provider value={value}>
      {loading ? (
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-neutral-400">Initializing BaseTC...</p>
        </div>
      ) : !fid && !isInFrame ? (
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
