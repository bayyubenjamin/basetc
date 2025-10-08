// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import Header from "./components/Header";

/** ==== metadata versi ringkas (TETAP DIPERTAHANKAN) ==== */
export const metadataBasic: Metadata = {
  title: "BaseTC Console",
  description: "Mining NFT on Base",
};

/** ==== RootLayout varian 1 (dengan Header) — DIPERTAHANKAN ==== */
export function RootLayoutWithHeader({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-zinc-950">
      <body className="min-h-dvh text-zinc-200 antialiased">
        <Header />
        {/* Spacer opsional kalau kamu punya navbar lain yang sticky */}
        {/* <div className="h-0" /> */}
        {children}
      </body>
    </html>
  );
}

/** ==== Payload Mini App — global agar card muncul untuk URL apa pun yang dicast ==== */
const fcPayload = {
  version: "1",
  imageUrl: "https://basetc.xyz/img/feed.png",
  button: {
    title: "Open BaseTC",
    action: {
      type: "launch_miniapp",
      name: "BaseTC Console",
      url: "https://basetc.xyz/launch",
      splashImageUrl: "https://basetc.xyz/s.png",
      splashBackgroundColor: "#FFFFFF",
    },
  },
};

/** ==== metadata versi lengkap (INI YANG DIEKSPOR SEBAGAI `metadata`) ==== */
export const metadata: Metadata = {
  metadataBase: new URL("https://basetc.xyz"),
  alternates: { canonical: "https://basetc.xyz/" },
  title: "BaseTC MiniApp",
  description: "Farcaster mining console built with Next.js and Tailwind.",
  openGraph: {
    type: "website",
    url: "https://basetc.xyz/",
    title: "BaseTC Console",
    description: "Start mining with a free Basic rig onchain.",
    images: [{ url: "/img/feed.png", width: 1200, height: 630, alt: "BaseTC Console" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "BaseTC Console",
    description: "Start mining with a free Basic rig onchain.",
    images: ["/img/feed.png"],
  },
  // ❗️Taruh fc:miniapp / fc:frame di global supaya CAST URL APA PUN ada card
  other: {
    "fc:miniapp": JSON.stringify(fcPayload),
    "fc:frame": JSON.stringify(fcPayload),
  },
};

/** ==== RootLayout varian 2 (tanpa Header) — DIPERTAHANKAN ==== */
export function RootLayoutBase({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  );
}

/** ==== RootLayout FINAL (DEFAULT EXPORT) ====
 * Menggabungkan atribut dari kedua varian:
 * - html: pakai lang="en" + class bg-zinc-950
 * - body: gabung class "min-h-dvh text-zinc-200 antialiased" + "min-h-screen flex flex-col"
 * - tetap render <Header /> sebelum {children}
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-zinc-950">
      <body className="min-h-dvh min-h-screen flex flex-col text-zinc-200 antialiased">
        <Header />
        {children}
      </body>
    </html>
  );
}