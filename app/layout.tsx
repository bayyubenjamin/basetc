// app/launch/layout.tsx
import type { Metadata } from "next";

const payload = {
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
  alternates: { canonical: "https://basetc.xyz/launch" },
  title: "BaseTC Console",
  description: "Start mining with a free Basic rig onchain.",
  openGraph: {
    type: "website",
    url: "https://basetc.xyz/launch",
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
    "fc:miniapp": JSON.stringify(payload),
    "fc:frame": JSON.stringify(payload),
  },
};

export default function LaunchLayout({ children }: { children: React.ReactNode }) {
  // server component wrapper khusus segment /launch
  return <>{children}</>;
}

