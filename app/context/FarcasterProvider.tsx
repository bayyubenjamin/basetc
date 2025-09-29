// File: app/context/FarcasterUserProvider.tsx
"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

// Tipe ini bisa diimpor dari file tipe terpusat jika ada
export type FarcasterUser = {
  fid: number | null;
  username: string | null;
  displayName: string | null;
  pfpUrl: string | null;
};

interface FarcasterUserContextType {
  user: FarcasterUser;
  isLoading: boolean;
  isReady: boolean; // Menandakan apakah upaya pengambilan data awal telah selesai
}

const FarcasterUserContext = createContext<FarcasterUserContextType | undefined>(undefined);

export function FarcasterUserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FarcasterUser>({ fid: null, username: null, displayName: null, pfpUrl: null });
  const [isLoading, setIsLoading] = useState(true);
  const = useState(false);

  useEffect(() => {
    let isCancelled = false;

    const initialize = async () => {
      try {
        // Impor SDK secara dinamis untuk memastikan kode ini hanya berjalan di sisi klien
        const mod: any = await import("@farcaster/miniapp-sdk");
        const sdk: any = mod?.sdk;

        // Beri sinyal ke klien Farcaster bahwa UI aplikasi siap untuk ditampilkan.
        // Ini harus dilakukan di awal untuk menghindari splash screen yang berkepanjangan.
        try { await sdk?.actions?.ready?.(); } catch {}

        // Upaya tangguh untuk mendapatkan konteks pengguna.
        // Ini menangani race condition di mana SDK tidak langsung tersedia.
        let context: any = null;
        for (let i = 0; i < 10; i++) { // Coba ulang selama ~5 detik
          const rawCtx = sdk?.context;
          if (rawCtx) {
            if (typeof rawCtx === "function") context = await rawCtx.call(sdk);
            else if (rawCtx && typeof rawCtx.then === "function") context = await rawCtx;
            else context = rawCtx?? null;
          }
          if (context?.user?.fid) break;
          await new Promise(r => setTimeout(r, 500));
        }
        
        if (isCancelled) return;

        if (context?.user?.fid) {
          const u = context.user;
          const profile: FarcasterUser = {
            fid: u.fid,
            username: u.username?? null,
            displayName: u.displayName?? null,
            pfpUrl: u.pfpUrl?? null,
          };
          setUser(profile);
          // Simpan FID untuk digunakan bagian lain dari aplikasi (misalnya, panggilan backend)
          localStorage.setItem('basetc_fid', String(u.fid));
        } else {
          // Logika fallback untuk pengujian di luar klien Farcaster
          const url = new URL(window.location.href);
          const qfid = url.searchParams.get("fid") |

| localStorage.getItem("basetc_fid");
          if (qfid && /^\d+$/.test(qfid)) {
            setUser(prev => ({...prev, fid: Number(qfid) }));
          }
        }
      } catch (error) {
        console.error("Gagal menginisialisasi konteks Farcaster:", error);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
          setIsReady(true);
        }
      }
    };

    initialize();

    return () => {
      isCancelled = true;
    };
  },);

  const value = { user, isLoading, isReady };

  return (
    <FarcasterUserContext.Provider value={value}>
      {children}
    </FarcasterUserContext.Provider>
  );
}

export const useFarcasterUser = (): FarcasterUserContextType => {
  const context = useContext(FarcasterUserContext);
  if (context === undefined) {
    throw new Error('useFarcasterUser harus digunakan di dalam FarcasterUserProvider');
  }
  return context;
};
