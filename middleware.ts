// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Daftar User-Agent dari klien Farcaster
const FARCASTER_HINTS = ["Warpcast", "Farcaster", "V2Frame"];

// Universal Link Mini App Anda
const UNIVERSAL_LINK = "https://farcaster.xyz/miniapps/PkHG0AuDhXrd/basetc-console";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const { searchParams } = request.nextUrl;
  const fidref = searchParams.get('fidref');

  // Jika ada fidref di URL, simpan ke dalam cookie.
  // Cookie ini akan dibaca oleh API route nanti.
  if (fidref && /^\d+$/.test(fidref)) {
    // Hanya set cookie jika belum ada untuk menghindari penimpaan yang tidak perlu.
    if (!request.cookies.has('fid_ref')) {
      response.cookies.set('fid_ref', fidref, {
        path: '/',
        maxAge: 60 * 60 * 24, // Cookie berlaku selama 1 hari
        httpOnly: true, // Lebih aman, tidak bisa diakses dari JavaScript sisi klien
        sameSite: 'lax',
      });
    }
  }

  // --- Sisa Logika Middleware Anda (Tidak Berubah) ---
  const ua = request.headers.get('user-agent') || "";
  const isFarcasterClient = FARCASTER_HINTS.some((k) => ua.includes(k));
  const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);

  // Jika dari mobile browser (bukan Farcaster), redirect ke universal link
  if (!isFarcasterClient && isMobile) {
    const redirectUrl = new URL(UNIVERSAL_LINK);
    redirectUrl.search = searchParams.toString();
    
    // Gunakan redirect sementara agar browser mengirimkan cookie yang baru di-set.
    const redirectResponse = NextResponse.redirect(redirectUrl, 307);

    // Salin cookie yang sudah di-set ke response redirect
    if (fidref && /^\d+$/.test(fidref)) {
        if (!request.cookies.has('fid_ref')) {
            redirectResponse.cookies.set('fid_ref', fidref, {
                path: '/',
                maxAge: 60 * 60 * 24,
                httpOnly: true,
                sameSite: 'lax',
            });
        }
    }
    return redirectResponse;
  }

  return response;
}

// Tentukan path mana saja yang akan dijalankan oleh middleware ini
export const config = {
  matcher: [
    '/',
    '/launch',
  ],
}
