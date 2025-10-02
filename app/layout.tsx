// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";

const payload = {
  version: "1",
  imageUrl: "https://basetc.xyz/api/og", // fallback OG dynamic
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
  title: "BaseTC MiniApp",
  description: "Farcaster mining console built with Next.js and Tailwind.",
  openGraph: {
    title: "BaseTC Console",
    description: "Start mining with a free Basic rig onchain.",
    images: [
      {
        url: "https://basetc.xyz/api/og", // dynamic endpoint
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BaseTC Console",
    description: "Start mining with a free Basic rig onchain.",
    images: ["https://basetc.xyz/api/og"],
  },
  other: {
    "fc:miniapp": JSON.stringify(payload),
    "fc:frame": JSON.stringify(payload),
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  );
}

