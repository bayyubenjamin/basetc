// app/context/FarcasterProvider.tsx
"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

type FarcasterUser = {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
};

// Tambahkan 'ready' ke tipe konteks
type MiniAppContext = {
  user?: FarcasterUser;
  ready: boolean;
};

// Beri nilai default
const FarcasterContext = createContext<MiniAppContext>({ ready: false });

export function FarcasterProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<MiniAppContext>({ ready: false });

  useEffect(() => {
    const init = async () => {
      try {
        const { sdk } = await import("@farcaster/miniapp-sdk");
        const fcContext = await sdk.getContext();
        setContext({ ...fcContext, ready: true });
      } catch (error) {
        console.warn("Could not get Farcaster context", error);
        setContext({ ready: true }); // Tetap set ready, meskipun konteks gagal
      }
    };
    init();
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
