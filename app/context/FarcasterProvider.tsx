// app/context/FarcasterProvider.tsx
//
// Alasan Perbaikan Definitif: Memperbaiki build error "getContext does not exist"
// dan masalah "stuck di splash screen". Menggunakan `await sdk.context` yang benar
// dan memastikan flag `ready` selalu di-set ke `true` setelah inisialisasi selesai,
// baik berhasil maupun gagal.
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
  theme?: 'light' | 'dark';
  colorScheme?: 'light' | 'dark';
  ready: boolean; // Flag untuk menandakan proses inisialisasi selesai
};

const FarcasterContext = createContext<MiniAppContext | undefined>(undefined);

export function FarcasterProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<MiniAppContext>({ ready: false });

  useEffect(() => {
    let isCancelled = false;
    const initialize = async () => {
      try {
        const { sdk } = await import('@farcaster/miniapp-sdk');
        
        // Polling untuk mendapatkan konteks dengan cepat
        for (let i = 0; i < 20; i++) { // Coba selama 2 detik
          // --- FIX DI SINI: Menggunakan `await sdk.context` yang benar ---
          const ctx = await sdk.context;
          if (ctx?.user?.fid) {
            if (!isCancelled) {
              setContext({
                user: {
                  fid: ctx.user.fid,
                  username: ctx.user.username,
                  displayName: ctx.user.displayName,
                  pfpUrl: ctx.user.pfpUrl,
                },
                theme: ctx.theme,
                colorScheme: ctx.colorScheme,
                ready: true,
              });
              // Beri sinyal ke host Farcaster bahwa app siap
              sdk.actions.ready().catch(() => {});
            }
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        
        // Jika setelah polling tetap tidak ada, set ready ke true
        if (!isCancelled) {
            setContext({ ready: true, user: undefined });
        }

      } catch (error) {
        console.warn('Farcaster SDK not found or failed, running in standalone mode.', error);
        if (!isCancelled) {
          setContext({ ready: true, user: undefined }); // Tandai siap bahkan jika SDK gagal
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


