// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";

// Payload miniapp/frames untuk Farcaster (jangan isi action.url biar gak bentrok)
const payload = {
  version: "1",
  imageUrl: "https://basetc.xyz/img/feed.png",
  button: {
    title: "Open BaseTC",
    action: {
      type: "launch_miniapp",
      name: "BaseTC Console",
      // ❌ jangan taruh "url" di sini; Farcaster akan pakai homeUrl dari farcaster.json (/launch)
      splashImageUrl: "https://basetc.xyz/s.png",
      splashBackgroundColor: "#FFFFFF"
    }
  }
};

export const metadata: Metadata = {
  metadataBase: new URL("https://basetc.xyz"),                // ✅ bikin url absolut
  alternates: { canonical: "https://basetc.xyz/" },           // ✅ canonical tanpa query
  title: "BaseTC MiniApp",
  description: "Farcaster mining console built with Next.js and Tailwind.",
  openGraph: {
    type: "website",
    url: "https://basetc.xyz/",
    title: "BaseTC Console",
    description: "Start mining with a free Basic rig onchain.",
    images: [
      {
        url: "/img/feed.png",                                  // ✅ statis, no-code, no-logic
        width: 1200,
        height: 630,
        alt: "BaseTC Console"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "BaseTC Console",
    description: "Start mining with a free Basic rig onchain.",
    images: ["/img/feed.png"]                                  // ✅ sama dengan OG
  },
  other: {
    "fc:miniapp": JSON.stringify(payload),
    "fc:frame": JSON.stringify(payload)
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
