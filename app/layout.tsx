// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import React from "react";

// Embed Mini App untuk Farcaster — HARUS di SSR head (via metadata)
const miniapp = {
  version: "1",
  imageUrl: "https://basetc.vercel.app/img/feed.png", // rasio 3:2 (mis. 1200x800)
  button: {
    title: "Open BaseTC",
    action: {
      type: "launch_miniapp", // atau "launch_frame"
      name: "BaseTC Mini App",
      url: "https://basetc.vercel.app/launch",
      splashImageUrl: "/s.png", // PNG/JPG 200x200, URL pendek (≤32 char)
      splashBackgroundColor: "#0b0b0b",
    },
  },
};

export const metadata: Metadata = {
  title: "BaseTC MiniApp",
  description: "Farcaster mining console built with Next.js and Tailwind.",
  // KUNCI: meta Farcaster di-render server-side ke <head>
  other: {
    "fc:miniapp": JSON.stringify(miniapp),
    // (opsional) backward-compat klien lama:
    // "fc:frame": JSON.stringify(miniapp),
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* Biarkan Next merender <head> dari metadata di atas */}
      <body className="min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}

