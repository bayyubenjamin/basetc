// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Daftar User-Agent dari klien Farcaster
const FARCASTER_HINTS = ["Warpcast", "Farcaster", "V2Frame"];

// Universal Link Mini App Anda
const UNIVERSAL_LINK = "https://farcaster.xyz/miniapps/PkHG0AuDhXrd/basetc-console";

export function middleware(request: NextRequest) {
  const ua = request.headers.get('user-agent') || "";
  const isFarcasterClient = FARCASTER_HINTS.some((k) => ua.includes(k));
  const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
  
  // Ambil semua parameter dari URL yang masuk
  const searchParams = request.nextUrl.search;

  // --- LOGIKA UTAMA YANG DIPERBAIKI ---

  // KASUS 1: Jika request datang DARI DALAM Klien Farcaster.
  // Biarkan saja, jangan lakukan apa-apa.
  if (isFarcasterClient) {
    return NextResponse.next();
  }

  // KASUS 2: Jika request datang dari LUAR Farcaster DAN dari PERANGKAT MOBILE.
  // Ini adalah kondisi untuk redirect.
  if (isMobile) {
    // Buat URL baru menggunakan Universal Link
    const redirectUrl = new URL(UNIVERSAL_LINK);
    // Salin semua parameter dari URL asli (?fidref=... dll) ke Universal Link
    redirectUrl.search = searchParams;
    
    // Lakukan redirect.
    return NextResponse.redirect(redirectUrl);
  }

  // KASUS 3: Jika bukan dari Farcaster dan bukan dari Mobile (artinya DESKTOP).
  // Jangan lakukan apa-apa, biarkan Next.js merender halaman seperti biasa (landing page).
  return NextResponse.next();
}

// Tentukan path mana saja yang akan dijalankan oleh middleware ini
export const config = {
  matcher: [
    '/',
    '/launch',
  ],
}
