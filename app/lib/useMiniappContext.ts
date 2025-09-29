"use client";

import { useEffect, useState } from "react";

export type MiniCtxUser = {
  fid: number | null;
  username: string | null;
  displayName: string | null;
  pfpUrl: string | null;
};

export function useMiniappContext() {
  const [user, setUser] = useState<MiniCtxUser>({ fid: null, username: null, displayName: null, pfpUrl: null });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const mod: any = await import("@farcaster/miniapp-sdk");
        const sdk: any = mod?.sdk;

        try { await sdk?.actions?.ready?.(); } catch {}

        const tryGet = async () => {
          if (typeof sdk?.getContext === "function") return await sdk.getContext();
          const raw = sdk?.context;
          if (typeof raw === "function") return await raw.call(sdk);
          if (raw && typeof raw.then === "function") return await raw;
          return raw ?? null;
        };

        let ctx: any = null;
        for (let i = 0; i < 6; i++) { // total ~3 detik
          ctx = await tryGet();
          if (ctx?.user?.fid) break;
          await new Promise(r => setTimeout(r, 500));
        }

        let u = ctx?.user ?? {};
        let fid = u?.fid ?? null;

        // fallback: query/localStorage untuk testing di browser biasa
        if (!fid) {
          try {
            const url = new URL(window.location.href);
            const qfid = url.searchParams.get("fid") || localStorage.getItem("basetc_fid");
            if (qfid && /^\d+$/.test(qfid)) fid = Number(qfid);
          } catch {}
        }

        if (!alive) return;
        setUser({
          fid: fid ?? null,
          username: u?.username ?? null,
          displayName: u?.displayName ?? null,
          pfpUrl: u?.pfpUrl ?? null,
        });
        setReady(true);
      } catch {
        if (!alive) return;
        setReady(true);
      }
    })();

    return () => { alive = false; };
  }, []);

  return { user, ready };
}

