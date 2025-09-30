// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";

const payload = {
  version: "1",
  imageUrl: "https://basetc.vercel.app/img/feed.png",     // 3:2, <1MB
  button: {
    title: "Open BaseTC",
    action: {
      type: "launch_miniapp",                              // atau "launch_frame"
      name: "BaseTC Mini App",
      url: "https://basetc.vercel.app/launch",
      splashImageUrl: "https://basetc.vercel.app/s.png",   // ABSOLUT, 200x200 PNG/JPG
      splashBackgroundColor: "#0b0b0b"
    }
  }
};

export const metadata: Metadata = {
  title: "BaseTC MiniApp",
  description: "Farcaster mining console built with Next.js and Tailwind.",
  other: {
    "fc:miniapp": JSON.stringify(payload),  // format baru
    "fc:frame":   JSON.stringify(payload)   // fallback legacy
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  );
}

