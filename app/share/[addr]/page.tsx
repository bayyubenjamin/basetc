// app/share/[addr]/page.tsx
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: { addr: string } };

function abs(url: string) {
  const hdrs = headers();
  const host = hdrs.get("x-forwarded-host") || hdrs.get("host") || "basetc.vercel.app";
  const proto = (hdrs.get("x-forwarded-proto") || "https").split(",")[0];
  const base = `${proto}://${host}`;
  return url.startsWith("http") ? url : `${base}${url}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { addr } = params;
  if (!addr || !addr.startsWith("0x") || addr.length !== 42) {
    notFound();
  }

  // cache buster untuk force re-scrape
  const v = Date.now().toString(36);

  // OG image absolute URL → menunjuk ke /api/og dengan param minimal
  const imageUrl = abs(`/api/og?name=Miner&ref=${encodeURIComponent(addr)}&v=${v}`);

  // Farcaster Miniapp payload (disarankan menambahkan aspectRatio 3:2)
  const payload = {
    version: "1",
    imageUrl,              // absolute
    aspectRatio: "3:2",
    button: {
      title: "Open BaseTC",
      action: {
        type: "launch_miniapp",
        name: "BaseTC Console",
        url: abs("/launch"),
        splashImageUrl: abs("/s.png"),
        splashBackgroundColor: "#FFFFFF",
      },
    },
  };

  return {
    title: "BaseTC Share",
    description: "Personalized share card",
    openGraph: {
      title: "BaseTC Share",
      description: "Personalized share card",
      images: [
        {
          url: imageUrl,
          width: 1200,         // ← tambahkan eksplisit
          height: 800,         // ← tambahkan eksplisit
          alt: "BaseTC Share Card",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "BaseTC Share",
      description: "Personalized share card",
      images: [imageUrl],
    },
    other: {
      "fc:miniapp": JSON.stringify(payload),
      "fc:frame": JSON.stringify(payload), // fallback
    },
  };
}

export default function SharePage() {
  // boleh kosong—yang penting meta HEAD di atas
  return null;
}

