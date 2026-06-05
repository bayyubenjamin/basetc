// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import Ticker from "./components/Ticker";
import SilentAddMiniApp from "./components/SilentAddMiniApp";
import { Providers } from "./Providers";

const APP_URL = "https://basetc.vercel.app";

const fcPayload = {
  version: "1",
  imageUrl: `${APP_URL}/img/feed.png`,
  button: {
    title: "Open BaseTC",
    action: {
      type: "launch_miniapp",
      name: "BaseTC Console",
      url: `${APP_URL}/launch`,
      splashImageUrl: `${APP_URL}/img/splash.gif`,
      splashBackgroundColor: "#FFFFFF",
    },
  },
};

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  alternates: { canonical: `${APP_URL}/` },
  title: "BaseTC Console",
  description: "Farcaster mining console built with Next.js and Tailwind.",
  openGraph: {
    type: "website",
    url: `${APP_URL}/`,
    title: "BaseTC Console",
    description: "Start mining with a free Basic rig onchain.",
    images: [
      {
        url: `${APP_URL}/img/feed.png`,
        width: 1200,
        height: 630,
        alt: "BaseTC Console",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BaseTC Console",
    description: "Start mining with a free Basic rig onchain.",
    images: [`${APP_URL}/img/feed.png`],
  },
  other: {
    "fc:miniapp": JSON.stringify(fcPayload),
    "fc:frame": JSON.stringify(fcPayload),

    // ✅ INI YANG PENTING (harus sama dengan dashboard Base)
    "base:app_id": "69f8b77f47cf8ec7e6be16df",

    "talentapp:project_verification":
      "928a7d0ece3f0dda719b5fd9207e27ac14a616a8815000eb3c044ee3918610df5b70b01648d25e130882131023d3d7c3f122ea22739d08af2608b40e5004ff46",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased pt-[calc(env(safe-area-inset-top)+36px)]">
        <Providers>
          <Ticker />
          <SilentAddMiniApp />
          {children}
        </Providers>
        <footer className="fixed bottom-1 right-1 text-[10px] text-gray-500 opacity-50">
          v1.2-base-sprint
        </footer>
      </body>
    </html>
  );
}
