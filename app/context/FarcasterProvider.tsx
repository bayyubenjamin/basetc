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
    const init = async () => {
      try {
        const { sdk } = await import("@farcaster/miniapp-sdk");
        // FIX: Menggunakan sdk.context (properti), bukan sdk.getContext() (metode)
        const fcContext = await sdk.context; 
        setContext({ ...fcContext, ready: true });
      } catch (error) {
        console.warn("Could not get Farcaster context", error);
        setContext({ ready: true });
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
