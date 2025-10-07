// app/launch/page.tsx
"use client";

import { useEffect, useMemo, useState, type ReactNode, Suspense } from "react"; // <-- Tambahkan Suspense & ReactNode
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
// <-- Import tambahan
import { useSearchParams } from "next/navigation"; // <-- Tambahkan useSearchParams

const DEFAULT_TAB: TabName = "monitoring";
const TAB_KEY = "basetc_active_tab";

// Konstanta yang sama dengan di app/page.tsx
const UNIVERSAL_LINK = "https://farcaster.xyz/miniapps/PkHG0AuDhXrd/basetc-console";
const FARCASTER_HINTS = ["Warpcast", "Farcaster", "V2Frame"];

/**
 * Komponen baru untuk menangani logika pengalihan ke Universal Link
 * jika diakses dari browser luar dengan parameter referral.
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
    // Jalankan hanya di browser
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    const isWebPreview = url.searchParams.get("web") === "1"; // Izinkan preview web
    
    // Jika ada parameter referral DAN BUKAN mode preview web
    if (hasReferral && !isWebPreview) {
      const ua = navigator.userAgent || "";
      const isFarcaster = FARCASTER_HINTS.some((k) => ua.includes(k));

      if (!isFarcaster) {
        // BUKAN Farcaster client, BUKAN web preview, dan ADA referral -> Redirect ke Universal Link
        setIsRedirecting(true);
        const universalUrl = new URL(UNIVERSAL_LINK);
        
        // Salin semua parameter referral
        const ref = url.searchParams.get("ref");
        const fid = url.searchParams.get("fid");
        const fidref = url.searchParams.get("fidref");
        
        if (ref) universalUrl.searchParams.set("ref", ref);
        if (fid) universalUrl.searchParams.set("fid", fid);
        if (fidref) universalUrl.searchParams.set("fidref", fidref);

        // Paksa pengalihan segera
        window.location.replace(universalUrl.toString());
        return;
      }
    }
  }, [hasReferral, isRedirecting, searchParams]);

  if (isRedirecting) {
    // Tampilkan layar loading saat pengalihan sedang terjadi
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-950">
        <p className="text-neutral-400 animate-pulse">Redirecting to Farcaster Mini App...</p>
      </div>
    );
  }

  return children;
}


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

      // --- LOGIKA REFERRAL BARU (Mengatasi URL Stripping) ---
      (async () => {
        try {
          const url = new URL(window.location.href);

          // 1. Cek parameter baru: fidref (FID PENGUNDANG)
          const fidref = url.searchParams.get("fidref");
          let inviterWallet: string | null = null;

          if (fidref && /^\d+$/.test(fidref)) {
            // A. Ambil alamat wallet Inviter dari backend menggunakan FID mereka
            const res = await fetch("/api/user", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ mode: "get_wallet_by_fid", fid: Number(fidref) }),
            });
            const data = await res.json();

            // Verifikasi respons dari API resolver baru
            if (data?.ok && data.wallet && isAddress(data.wallet)) {
              inviterWallet = data.wallet;
            } else {
              console.warn(`FID Referral found (${fidref}), but wallet resolution failed:`, data?.error);
            }
          }

          // 2. Jika fidref gagal/tidak ada, coba cek parameter lama ('ref') atau dari local storage
          if (!inviterWallet) {
            const ref = url.searchParams.get("ref");
            if (ref && isAddress(ref)) {
              inviterWallet = ref;
            } else {
              // Final fallback check to localStorage
              const localRef = localStorage.getItem("basetc_ref");
              if (localRef && isAddress(localRef)) {
                inviterWallet = localRef;
              }
            }
          }

          // 3. Jika Inviter Wallet ditemukan, catat touch
          if (inviterWallet && inviterWallet.toLowerCase() !== "0x0000000000000000000000000000000000000000") {
            // Simpan alamat Inviter yang valid ke localStorage untuk langkah klaim berikutnya
            localStorage.setItem("basetc_ref", inviterWallet);
            // Catat touch ke Supabase (status pending)
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

// Komponen utama yang akan di-render untuk /dashboard
export default function Page() {
  return (
    <Providers>
      <FarcasterProvider>
        <Suspense fallback={<div>Loading app...</div>}>
          <ReferralRedirectGuard>
            <AppInitializer />
          </ReferralRedirectGuard>
        </Suspense>
      </FarcasterProvider>
    </Providers>
  );
}
