// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // 1. Lewati pemeriksaan untuk API, aset statis, dan gambar
  //    (Agar gambar/logo tetap loading di Base App)
  if (
    request.nextUrl.pathname.startsWith("/api") ||
    request.nextUrl.pathname.startsWith("/_next") ||
    request.nextUrl.pathname.startsWith("/img") ||
    request.nextUrl.pathname.startsWith("/favicon.ico")
  ) {
    return NextResponse.next();
  }

  // 2. Cek User Agent
  const ua = request.headers.get("user-agent") || "";
  
  // Jika User Agent adalah Base App atau Coinbase Wallet, JANGAN redirect.
  // Biarkan masuk ke halaman (nanti app/page.tsx yang handle)
  if (
    ua.includes("Coinbase") || 
    ua.includes("Ethereum") || 
    ua.includes("Base")
  ) {
    return NextResponse.next();
  }

  // 3. Logic Redirect Lama (Opsional: Jika Anda ingin tetap memaksa user biasa ke Farcaster)
  // Hati-hati: Base App kadang UA-nya mirip Chrome biasa.
  // LEBIH AMAN: Hapus redirect paksa di middleware, serahkan semua ke app/page.tsx
  // Kode di bawah ini saya komen agar aman:
  
  /*
  const isMobile = /android|iphone|ipad|ipod/i.test(ua);
  const isFarcaster = /warpcast|farcaster/i.test(ua);
  
  if (isMobile && !isFarcaster && request.nextUrl.pathname === "/") {
      // INI YANG BIKIN TERLEMPAR. HAPUS ATAU KOMENTAR BAGIAN INI.
      // return NextResponse.redirect("https://farcaster.xyz/miniapps/...");
  }
  */

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
