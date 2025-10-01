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
  const addr = params.addr;
  if (!addr || !addr.startsWith("0x") || addr.length !== 42) {
    notFound();
  }

  const v = Date.now().toString(36);
  // param minimal ke OG (semakin sedikit → semakin kecil size)
  const imageUrl = abs(`/api/og?ref=${encodeURIComponent(addr)}&name=Miner&v=${v}`);

  const payload = {
    version: "1",
    imageUrl,                 // HARUS absolute
    aspectRatio: "3:2",       // ← tambahkan ini
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
    title: `BaseTC Share`,
    description: "Personalized share card",
    openGraph: {
      images: [{ url: imageUrl, width: 1200, height: 800 }],
    },
    twitter: {
      card: "summary_large_image",
      images: [imageUrl],
    },
    other: {
      "fc:miniapp": JSON.stringify(payload),
      "fc:frame": JSON.stringify(payload), // fallback
    },
  };
}

export default function SharePage() {
  // Halaman ini boleh kosong—yang penting HEAD meta di atas
  return null;
}

