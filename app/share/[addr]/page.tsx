// app/share/[addr]/page.tsx
import type { Metadata } from "next";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

type Props = { params: { addr: string } };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "basetc.vercel.app";
  const proto = h.get("x-forwarded-proto") || "https";
  const base = `${proto}://${host}`;

  const addr = params.addr;
  const v = Date.now().toString(36); // cache buster
  const imageUrl = `${base}/api/og?user=${encodeURIComponent(addr)}&v=${v}`;

  const title = `BaseTC Invite – ${addr.slice(0, 6)}…${addr.slice(-4)}`;
  const description = "Claim a free Basic rig and start mining on BaseTC Console.";

  const payload = {
    version: "1",
    imageUrl,             // OG dinamis
    aspectRatio: "3:2",   // tambahkan agar jelas ke crawler
    button: {
      title: "Open BaseTC",
      action: {
        type: "launch_miniapp",
        name: "BaseTC Console",
        url: `${base}/launch`,
        splashImageUrl: `${base}/s.png`,
        splashBackgroundColor: "#FFFFFF",
      },
    },
  };

  return {
    metadataBase: new URL(base),
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: imageUrl, width: 1200, height: 800, alt: "BaseTC OG Card" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
    other: {
      "fc:miniapp": JSON.stringify(payload),
      "fc:frame": JSON.stringify(payload),
    },
  };
}

export default function SharePage({ params }: Props) {
  const { addr } = params;
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-6">
      <h1 className="text-2xl font-bold">BaseTC Invite</h1>
      <p className="mt-2 opacity-80">Referral address:</p>
      <code className="mt-1 px-2 py-1 bg-neutral-800 rounded">{addr}</code>
      <a href="/launch" className="mt-6 px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500">
        Open App
      </a>
    </main>
  );
}

