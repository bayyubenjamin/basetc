// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";

const imageUrl = "https://basetc.xyz/img/feed.png";
const launchUrl = "https://basetc.xyz/launch";
const splashUrl = "https://basetc.xyz/s.png";

const payload = {
  version: "1",
  imageUrl,
  button: {
    title: "Open BaseTC",
    action: {
      type: "launch_miniapp",
      name: "BaseTC Mini App",
      url: launchUrl,
      splashImageUrl: splashUrl,
      splashBackgroundColor: "#0b0b0b",
    },
  },
};

export const metadata: Metadata = {
  title: "BaseTC Console",
  description: "Farcaster BaseTC mining console.",
  other: {
    // Spec baru (JSON tunggal)
    "fc:miniapp": JSON.stringify(payload),
    "fc:frame": JSON.stringify(payload),

    // ---- LEGACY (vNext) — kompat maksimal ----
    "fc:frame-legacy": "1", // penanda internal—abaikan, tidak akan dirender
    "fc:frame (legacy format)": "vNext",
    "fc:frame:image": imageUrl,
    "fc:frame:post_url": "https://basetc.xyz/api/frame/actions",

    // Satu tombol "Open" yang langsung launch (link ke /launch)
    "fc:frame:button:1": "Open BaseTC",
    "fc:frame:button:1:action": "link",
    "fc:frame:button:1:target": launchUrl,

    // (Opsional) tombol kedua untuk “Open Monitoring”
    // "fc:frame:button:2": "Monitoring",
    // "fc:frame:button:2:action": "link",
    // "fc:frame:button:2:target": `${launchUrl}?tab=monitoring`,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  );
}

