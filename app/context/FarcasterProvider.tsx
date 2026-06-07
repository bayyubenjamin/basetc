// app/context/FarcasterProvider.tsx
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

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

function timeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

async function resolveSdkContext(sdk: any) {
  const raw = sdk?.context;

  if (!raw) return null;

  if (typeof raw === "function") {
    return await timeout(Promise.resolve(raw.call(sdk)), 700);
  }

  if (typeof raw?.then === "function") {
    return await timeout(raw, 700);
  }

  return raw;
}

async function safeReady(sdk: any) {
  try {
    await sdk?.actions?.ready?.();
  } catch {
    // ignore
  }
}

export function FarcasterProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<MiniAppContext>({ ready: false });

  useEffect(() => {
    let cancelled = false;

    async function init() {
      let sdk: any = null;

      try {
        const mod = await import("@farcaster/miniapp-sdk");
        sdk = mod?.sdk;

        // Jangan biarin host splash nunggu kelamaan.
        // Ini penting biar Farcaster/Base App tidak stuck loading.
        setTimeout(() => {
          if (!cancelled) safeReady(sdk);
        }, 300);

        let foundUser: FarcasterUser | undefined;

        for (let i = 0; i < 8; i++) {
          if (cancelled) return;

          const ctx: any = await resolveSdkContext(sdk);

          if (ctx?.user?.fid) {
            foundUser = {
              fid: ctx.user.fid,
              username: ctx.user.username,
              displayName: ctx.user.displayName,
              pfpUrl: ctx.user.pfpUrl,
            };
            break;
          }

          await new Promise((resolve) => setTimeout(resolve, 150));
        }

        if (cancelled) return;

        setContext({
          ready: true,
          user: foundUser,
        });

        await safeReady(sdk);
      } catch (err) {
        console.warn("Farcaster SDK init failed, continue standalone mode:", err);

        if (!cancelled) {
          setContext({
            ready: true,
            user: undefined,
          });
        }

        await safeReady(sdk);
      }
    }

    init();

    return () => {
      cancelled = true;
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

  if (!context) {
    throw new Error("useFarcaster must be used within FarcasterProvider");
  }

  return context;
}
