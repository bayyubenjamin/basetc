// app/context/FarcasterProvider.tsx
"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

type FarcasterUser = {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
};

type MiniAppContext = {
  user?: FarcasterUser;
  ready: boolean;
};

const FarcasterContext = createContext<MiniAppContext>({ ready: false });

export function FarcasterProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<MiniAppContext>({ ready: false });

  useEffect(() => {
    let isCancelled = false;

    const initialize = async () => {
      try {
        const { sdk } = await import("@farcaster/miniapp-sdk");
        
        let fcContext: any = null;
        // Coba ambil konteks beberapa kali untuk mengatasi race condition
        for (let i = 0; i < 15; i++) { // Coba selama ~3 detik
          if (isCancelled) return;
          try {
            // sdk.context bisa error jika Warpcast belum siap
            fcContext = await sdk.context;
            // Jika berhasil dan ada FID, keluar dari loop
            if (fcContext?.user?.fid) {
              break; 
            }
          } catch (e) {
            // Abaikan error sementara dan coba lagi
          }
          // Tunggu 200ms sebelum mencoba lagi
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        if (isCancelled) return;

        // Apapun hasilnya (dapat konteks atau tidak), set `ready` ke true
        setContext({
          user: fcContext?.user,
          ready: true,
        });

      } catch (error) {
        console.warn("Farcaster SDK gagal diinisialisasi.", error);
        if (!isCancelled) {
          setContext({ user: undefined, ready: true });
        }
      }
    };

    initialize();

    return () => {
      isCancelled = true;
    };
  }, []);

  return (
    <FarcasterContext.Provider value={context}>
      {children}
    </FarcasterContext.Provider>
  );
}

export function useFarcaster() {
  return useContext(FarcasterContext);
}
