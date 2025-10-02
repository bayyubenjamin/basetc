// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";

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
    images: [{ url: "/img/feed.png", width: 1200, height: 630, alt: "BaseTC Console" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "BaseTC Console",
    description: "Start mining with a free Basic rig onchain.",
    images: ["/img/feed.png"]
  }
  // ❌ Jangan taruh "other": { fc:miniapp / fc:frame } di GLOBAL layout.
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  );
}

