// app/context/FarcasterProvider.tsx
//
// Alasan Penulisan Ulang: Mengatasi masalah "stuck on splash screen".
// Provider ini sekarang hanya bertanggung jawab untuk satu hal: membaca data mentah
// dari Farcaster Mini App SDK secepat mungkin dan menyediakannya ke aplikasi.
// Semua logika fallback, fetch API, dan penyimpanan state dipindahkan ke `page.tsx`
// untuk alur data yang lebih jelas dan mencegah race condition.
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
          const ctx = sdk.getContext();
          if (ctx.fid) {
            if (!isCancelled) {
              setContext({
                user: {
                  fid: ctx.fid,
                  username: ctx.username,
                  displayName: ctx.displayName,
                  pfpUrl: ctx.pfpUrl,
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
            setContext({ ready: true });
        }

      } catch (error) {
        console.warn('Farcaster SDK not found or failed, running in standalone mode.', error);
        if (!isCancelled) {
          setContext({ ready: true }); // Tandai siap bahkan jika SDK gagal
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


