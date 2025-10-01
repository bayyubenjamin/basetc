import type { Metadata } from "next";

export const dynamic = "force-dynamic";

type Props = {
  params: { addr: string };
  searchParams: { name?: string; epoch?: string; v?: string };
};

export async function generateMetadata(
  { params, searchParams }: Props
): Promise<Metadata> {
  const addr = params.addr || "";
  const name = searchParams.name || "Miner";
  const epoch = searchParams.epoch || "";
  // cache-buster: jika tidak ada `v` dari client, tambahkan di server
  const v = searchParams.v || Date.now().toString(36);

  const og = `https://basetc.vercel.app/api/og?ref=${encodeURIComponent(
    addr
  )}&name=${encodeURIComponent(name)}${epoch ? `&epoch=${encodeURIComponent(epoch)}` : ""}&v=${v}`;

  return {
    title: "BaseTC Share",
    description: "Personalized share card",
    openGraph: {
      title: "BaseTC Share",
      description: "Personalized share card",
      images: [{ url: og, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "BaseTC Share",
      description: "Personalized share card",
      images: [og],
    },
    other: {
      // (opsional) bagi miniapp/frames – tapi tidak wajib untuk OG
      "fc:frame:post_url": "https://basetc.vercel.app/launch",
    },
  };
}

export default function SharePage() {
  // Halaman ini tidak perlu render apapun; meta saja yang penting
  return null;
}

