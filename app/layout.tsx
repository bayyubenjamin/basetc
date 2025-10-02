// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";

// Payload Mini App — berlaku global agar card muncul untuk URL apa pun yang dicast
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  );
}

