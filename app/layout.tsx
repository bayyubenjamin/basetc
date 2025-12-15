// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import Ticker from "./components/Ticker";
import SilentAddMiniApp from "./components/SilentAddMiniApp";
import { Providers } from "./Providers"; // Import component Providers yang baru

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

export const metadata: Metadata = {
  metadataBase: new URL("https://basetc.xyz"),
  alternates: { canonical: "https://basetc.xyz/" },
  title: "BaseTC Console",
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
  other: {
    "fc:miniapp": JSON.stringify(fcPayload),
    "fc:frame": JSON.stringify(fcPayload),
    "base:app_id": "694084f8d19763ca26ddc32e",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased pt-[calc(env(safe-area-inset-top)+36px)]">
        {/* Wrap seluruh konten dengan Providers */}
        <Providers>
          <Ticker />
          <SilentAddMiniApp />
          {children}
        </Providers>
      </body>
    </html>
  );
}
