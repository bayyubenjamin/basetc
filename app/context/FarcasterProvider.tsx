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

const FarcasterContext = createContext<MiniAppContext | undefined>(undefined);

export function FarcasterProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<MiniAppContext>({ ready: false });

  useEffect(() => {
    let isCancelled = false;

    const initialize = async () => {
      try {
        const { sdk } = await import('@farcaster/miniapp-sdk');
        
        // Polling cerdas untuk mendapatkan konteks
        for (let i = 0; i < 30; i++) { // Coba selama 3 detik (30 x 100ms)
          if (isCancelled) return;
          
          const ctx = await sdk.context;
          
          // Jika konteks berhasil didapatkan
          if (ctx?.user?.fid) {
            setContext({
              user: {
                fid: ctx.user.fid,
                username: ctx.user.username,
                displayName: ctx.user.displayName,
                pfpUrl: ctx.user.pfpUrl,
              },
              ready: true, // --> Kunci #1: Set status ready
            });
            // Beri sinyal ke host bahwa app siap
            sdk.actions.ready().catch(() => {}); // --> Kunci #2: Hilangkan spinner host
            return; // Hentikan polling
          }
          
          // Tunggu 100ms sebelum mencoba lagi
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        
        // Jika setelah 3 detik polling tetap gagal, anggap saja tidak ada konteks
        if (!isCancelled) {
            console.warn("Farcaster context not found after 3 seconds.");
            setContext({ ready: true, user: undefined }); // --> Kunci #3: Jaminan keluar dari splash
            sdk.actions.ready().catch(() => {});
        }

      } catch (error) {
        console.error('Farcaster SDK initialization failed:', error);
        if (!isCancelled) {
          setContext({ ready: true, user: undefined });
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
