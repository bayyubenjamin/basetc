// app/lib/farcaster.ts
export type FarcasterIds = { fid: number | null; referrerFid: number | null };

/** Ambil FID dari Farcaster Mini App SDK + persist referral dari ?ref= */
export async function getFarcasterIds(): Promise<FarcasterIds> {
  try {
    const mod = await import('@farcaster/miniapp-sdk');
    const rawCtx: any = (mod as any)?.sdk?.context;

    let ctx: any = null;
    if (typeof rawCtx === 'function') ctx = await rawCtx.call((mod as any).sdk);
    else if (rawCtx?.then) ctx = await rawCtx;
    else ctx = rawCtx ?? null;

    const fid: number | null = ctx?.user?.fid ?? null;

    const sp = new URL(window.location.href).searchParams;
    const refFromUrl = Number(sp.get('ref') || NaN);
    const refStored  = Number(localStorage.getItem('basetc_ref') || '0');
    const referrerFid = [refFromUrl, refStored].find(v => !!v && !Number.isNaN(v)) ?? null;
    if (referrerFid) localStorage.setItem('basetc_ref', String(referrerFid));

    return { fid, referrerFid: (referrerFid as number) ?? null };
  } catch {
    return { fid: null, referrerFid: null };
  }
}

/** Signal ready (dipanggil di page.tsx useEffect) */
export async function sdkReady() {
  try {
    const { sdk } = await import('@farcaster/miniapp-sdk');
    await sdk.actions.ready();
  } catch {}
}

