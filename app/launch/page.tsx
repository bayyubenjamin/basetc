// app/launch/page.tsx
"use client";

import { useEffect, useMemo, useState, type ReactNode, Suspense } from "react";
import { useAccount } from "wagmi";
import { Providers } from "../Providers";
import { FarcasterProvider, useFarcaster } from "../context/FarcasterProvider";
import Navigation, { type TabName } from "../components/Navigation";
import Monitoring from "../components/Monitoring";
import Rakit from "../components/Rakit";
import Market from "../components/Market";
import Profil from "../components/Profil";
import Event from "../components/Event";
import FidInput from "../components/FidInput";
import { isAddress } from "ethers";
import { useSearchParams } from "next/navigation";

const DEFAULT_TAB: TabName = "monitoring";
const TAB_KEY = "basetc_active_tab";

// Universal Link Farcaster Anda
const UNIVERSAL_LINK = "https://farcaster.xyz/miniapps/PkHG0AuDhXrd/basetc-console";
const FARCASTER_HINTS = ["Warpcast", "Farcaster", "V2Frame"];

/**
 * Komponen Guard dengan Logika yang Disederhanakan dan Diperbaiki
 */
function ReferralRedirectGuard({ children }: { children: ReactNode }) {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    // Cek hanya di sisi client
    if (typeof window === 'undefined') return;

    const ua = navigator.userAgent || "";
    const isFarcasterClient = FARCASTER_HINTS.some((k) => ua.includes(k));
    const isWebPreview = new URL(window.location.href).searchParams.get("web") === "1";

    // KONDISI UTAMA: HANYA redirect jika di luar Farcaster dan bukan mode web preview.
    if (!isFarcasterClient && !isWebPreview) {
      const redirectUrl = new URL(UNIVERSAL_LINK);
      redirectUrl.search = new URL(window.location.href).search; // Salin semua parameter
      window.location.replace(redirectUrl.toString());
      // Jangan render apapun, biarkan halaman loading default tampil selagi redirect
      return;
    }

    // Jika kita berada di dalam Farcaster atau mode web preview, izinkan aplikasi untuk render.
    setShouldRender(true);

  }, []);

  if (!shouldRender) {
    // Tampilkan layar loading HANYA saat pengecekan awal atau saat sedang redirect.
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-950">
        <p className="text-neutral-400 animate-pulse">Initializing...</p>
      </div>
    );
  }

  return children;
}


// ===============================================================
// TIDAK ADA PERUBAHAN DARI SINI KE BAWAH
// Semua fungsi aplikasi Anda tetap aman.
// ===============================================================

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
