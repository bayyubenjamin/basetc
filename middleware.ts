// middleware.ts

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

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

  // --- LOGIKA UTAMA ---

  // KASUS 1: Jika request datang dari DALAM Farcaster
  // Biarkan saja, jangan lakukan apa-apa. Biarkan Next.js merender halaman seperti biasa.
  if (isFarcasterClient) {
    return NextResponse.next();
  }

  // KASUS 2: Jika request datang dari LUAR Farcaster (misal: Chrome di HP)
  // dan berasal dari perangkat mobile.
  if (isMobile) {
    // Buat URL baru menggunakan Universal Link
    const redirectUrl = new URL(UNIVERSAL_LINK);
    // Salin semua parameter dari URL asli (?fidref=... dll) ke Universal Link
    redirectUrl.search = searchParams;
    
    // Lakukan redirect permanen di sisi server. Ini sangat cepat dan andal.
    return NextResponse.redirect(redirectUrl);
  }

  // KASUS 3: Jika request datang dari browser desktop
  // Biarkan saja, yang akan tampil adalah halaman landing page Anda.
  return NextResponse.next();
}

// Tentukan path mana saja yang akan dijalankan oleh middleware ini
export const config = {
  matcher: [
    '/',
    '/launch',
  ],
}
