// app/context/FarcasterProvider.tsx
'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';

// Tipe data sesuai dokumentasi Farcaster Mini App SDK
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

// Fungsi helper untuk membuat promise yang akan ditolak setelah timeout
const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Promise timed out after ${ms} ms`));
    }, ms);

    promise
      .then(value => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(err => {
        clearTimeout(timer);
        reject(err);
      });
  });
};


export function FarcasterProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<MiniAppContext>({ ready: false });

  useEffect(() => {
    let isCancelled = false;
    const initialize = async () => {
      try {
        const { sdk } = await import('@farcaster/miniapp-sdk');
        
        // Meminta konteks dengan timeout 3 detik.
        const ctx = await withTimeout(sdk.context, 3000).catch(err => {
          console.warn("Farcaster context timed out or failed:", err.message);
          return null; // Jika timeout atau error, kembalikan null
        });

        if (isCancelled) return;

        // Set state dengan hasil yang didapat, baik berhasil maupun tidak.
        setContext({
          user: ctx?.user,
          ready: true, // --> KUNCI UTAMA: `ready` dijamin menjadi `true`
        });

        // Tetap beri sinyal `ready` ke host, bahkan jika konteks gagal.
        // Ini akan menghilangkan spinner loading dari sisi Warpcast.
        sdk.actions.ready().catch(() => {});

      } catch (error) {
        console.error('Farcaster SDK could not be imported or initialized:', error);
        if (!isCancelled) {
          // Jika SDK gagal total, tetap set `ready` ke true.
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
  const context = useContext(FarcasterContext);
  if (context === undefined) {
    throw new Error('useFarcaster must be used within a FarcasterProvider');
  }
  return context;
}
