// app/lib/utils.ts

// ---- helper: cari fidref dari URL, referrer, lalu sessionStorage ----
export function getFidRefFallback(): string | undefined {
    // 1) URL saat ini
    try {
        const url = new URL(window.location.href);
        const f1 = url.searchParams.get("fidref");
        if (f1 && /^\d+$/.test(f1)) return f1;
    } catch {}
    // 2) document.referrer (iframe Farcaster)
    try {
        if (document.referrer) {
            const ru = new URL(document.referrer);
            const f2 = ru.searchParams.get("fidref");
            if (f2 && /^\d+$/.test(f2)) return f2;
        }
    } catch {}
    // 3) sessionStorage (persist per session)
    const f3 = sessionStorage.getItem("basetc_fid_ref");
    if (f3 && /^\d+$/.test(f3)) return f3;
    return undefined;
}
