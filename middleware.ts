// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const FARCASTER_HINTS = ["Warpcast", "Farcaster", "V2Frame"];
const UNIVERSAL_LINK = "https://farcaster.xyz/miniapps/PkHG0AuDhXrd/basetc-console";

export function middleware(req: NextRequest) {
  const url = req.nextUrl;

  // 1) Simpan fidref ke cookie (SEBELUM redirect apa pun)
  const fidref = url.searchParams.get("fidref");
  let res = NextResponse.next();
  if (fidref && /^\d+$/.test(fidref)) {
    res.cookies.set("fid_ref", fidref, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",   // <-- lowercase (fix)
      secure: true,
      maxAge: 60 * 60 * 24,
    });
  }

  // 2) Canonical: www -> apex (jaga query)
  if (url.hostname === "www.basetc.xyz") {
    const to = new URL(req.url);
    to.hostname = "basetc.xyz";
    return NextResponse.redirect(to, 308);
  }

  // 3) Mobile non-Farcaster → Universal Link (jaga query)
  const ua = req.headers.get("user-agent") || "";
  const isFarcasterClient = FARCASTER_HINTS.some((k) => ua.includes(k));
  const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);

  if (!isFarcasterClient && isMobile && url.pathname === "/launch") {
    const to = new URL(UNIVERSAL_LINK);
    to.search = url.search;
    const redirectRes = NextResponse.redirect(to, 307);

    if (fidref && /^\d+$/.test(fidref)) {
      redirectRes.cookies.set("fid_ref", fidref, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",  // <-- lowercase (fix)
        secure: true,
        maxAge: 60 * 60 * 24,
      });
    }
    return redirectRes;
  }

  return res;
}

export const config = {
  matcher: ["/", "/launch"],
};

