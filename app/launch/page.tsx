// app/launch/page.tsx

// ... (impor dan kode lain di atas biarkan sama)

const DEFAULT_TAB: TabName = "monitoring";
const TAB_KEY = "basetc_active_tab";

// Universal Link ANDA
const UNIVERSAL_LINK = "https://farcaster.xyz/miniapps/PkHG0AuDhXrd/basetc-console";
const FARCASTER_HINTS = ["Warpcast", "Farcaster", "V2Frame"];

/**
 * INI BAGIAN YANG DIPERBAIKI (FINAL)
 * Menggunakan Universal Link dan menambahkan URL target sebagai parameter.
 */
function ReferralRedirectGuard({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const hasReferral = useMemo(() => {
    const ref = searchParams.get("ref");
    const fid = searchParams.get("fid");
    const fidref = searchParams.get("fidref");
    return Boolean(ref || fid || fidref);
  }, [searchParams]);

  useEffect(() => {
    if (typeof window === 'undefined' || isRedirecting) return;

    const currentUrl = new URL(window.location.href);
    const isWebPreview = currentUrl.searchParams.get("web") === "1";
    
    if (hasReferral && !isWebPreview) {
      const ua = navigator.userAgent || "";
      const isFarcasterClient = FARCASTER_HINTS.some((k) => ua.includes(k));

      if (!isFarcasterClient) {
        setIsRedirecting(true);

        // ---- LOGIKA PENGALIHAN YANG BENAR ----
        
        // 1. Siapkan URL Universal Link dari Farcaster.
        const redirectUrl = new URL(UNIVERSAL_LINK);

        // 2. Siapkan URL mini-app Anda yang asli, pastikan path-nya /launch
        //    dan semua parameter referral ikut serta.
        const targetMiniAppUrl = new URL(currentUrl.origin);
        targetMiniAppUrl.pathname = '/launch';
        targetMiniAppUrl.search = currentUrl.search; // Ini menyalin SEMUA parameter (?fidref=... dll)

        // 3. Tambahkan URL mini-app Anda sebagai search parameter 'url' ke Universal Link.
        redirectUrl.searchParams.set('url', targetMiniAppUrl.toString());
        
        // 4. Lakukan pengalihan.
        window.location.replace(redirectUrl.toString());
      }
    }
  }, [hasReferral, isRedirecting, searchParams]);

  if (isRedirecting) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-950">
        <p className="text-neutral-400 animate-pulse">Opening in Farcaster...</p>
      </div>
    );
  }

  return children;
}


// ... Sisa dari file (MainApp, AppInitializer, export default, dll.)
// TIDAK PERLU DIUBAH. Biarkan seperti sebelumnya.
function MainApp() {
  const [activeTab, setActiveTab] = useState<TabName>(DEFAULT_TAB);
  const { address } = useAccount();

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const q = (url.searchParams.get("tab") || "").toLowerCase();
      const validTabs: TabName[] = ["monitoring", "rakit", "market", "profil", "event"];
      const fromQuery = validTabs.includes(q as TabName) ? (q as TabName) : null;
      const fromStorage = localStorage.getItem(TAB_KEY) as TabName;
      const initial = fromQuery || (validTabs.includes(fromStorage) ? fromStorage : DEFAULT_TAB);
      setActiveTab(initial);
    } catch {
      setActiveTab(DEFAULT_TAB);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(TAB_KEY, activeTab);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [activeTab]);

  useEffect(() => {
    const fidStr = localStorage.getItem("basetc_fid");
    if (!address || !fidStr) return;
    fetch("/api/user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fid: Number(fidStr), wallet: address }),
    }).catch((err) => console.error("Wallet mapping upsert failed:", err));
  }, [address]);

  const content = useMemo(() => {
    switch (activeTab) {
      case "rakit":
        return <Rakit />;
      case "market":
        return <Market />;
      case "profil":
        return <Profil />;
      case "event":
        return <Event />;
      default:
        return <Monitoring />;
    }
  }, [activeTab]);

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 pb-24">{content}</main>
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}

function AppInitializer() {
  const { user, ready } = useFarcaster();
  const [resolvedFid, setResolvedFid] = useState<number | null>(null);

  useEffect(() => {
    if (!ready) return;

    let finalFid: number | null = null;
    if (user?.fid) {
      finalFid = user.fid;
      fetch("/api/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fid: user.fid,
          username: user.username,
          display_name: user.displayName,
          pfp_url: user.pfpUrl,
        }),
      }).catch((err) => console.error("Context user auto-upsert failed:", err));
    } else {
      try {
        const url = new URL(window.location.href);
        const qfid = url.searchParams.get("fid") || localStorage.getItem("basetc_fid");
        if (qfid && /^\d+$/.test(qfid)) finalFid = Number(qfid);
      } catch {}
    }

    if (finalFid) {
      localStorage.setItem("basetc_fid", String(finalFid));
      setResolvedFid(finalFid);

      (async () => {
        try {
          const url = new URL(window.location.href);
          const fidref = url.searchParams.get("fidref");
          let inviterWallet: string | null = null;

          if (fidref && /^\d+$/.test(fidref)) {
            const res = await fetch("/api/user", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ mode: "get_wallet_by_fid", fid: Number(fidref) }),
            });
            const data = await res.json();
            if (data?.ok && data.wallet && isAddress(data.wallet)) {
              inviterWallet = data.wallet;
            } else {
              console.warn(`FID Referral found (${fidref}), but wallet resolution failed:`, data?.error);
            }
          }

          if (!inviterWallet) {
            const ref = url.searchParams.get("ref");
            if (ref && isAddress(ref)) {
              inviterWallet = ref;
            } else {
              const localRef = localStorage.getItem("basetc_ref");
              if (localRef && isAddress(localRef)) {
                inviterWallet = localRef;
              }
            }
          }

          if (inviterWallet && inviterWallet.toLowerCase() !== "0x0000000000000000000000000000000000000000") {
            localStorage.setItem("basetc_ref", inviterWallet);
            fetch("/api/referral", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ mode: "touch", inviter: inviterWallet, invitee_fid: finalFid }),
            }).catch((err) => console.error("Referral touch failed:", err));
          }
        } catch (error) {
          console.error("General referral processing error:", error);
        }
      })();
    }
  }, [ready, user]);

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-950">
        <p className="text-neutral-400 animate-pulse">Initializing BaseTC...</p>
      </div>
    );
  }

  if (resolvedFid) {
    return <MainApp />;
  }

  return (
    <FidInput
      setFid={(fid) => {
        localStorage.setItem("basetc_fid", String(fid));
        setResolvedFid(fid);
      }}
    />
  );
}

export default function Page() {
  return (
    <Providers>
      <FarcasterProvider>
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-neutral-950 text-neutral-400">Loading App...</div>}>
          <ReferralRedirectGuard>
            <AppInitializer />
          </ReferralRedirectGuard>
        </Suspense>
      </FarcasterProvider>
    </Providers>
  );
}
