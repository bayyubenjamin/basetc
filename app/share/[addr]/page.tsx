import type { Metadata } from "next";

type Props = {
  params: { addr: string };
  searchParams: { v?: string; name?: string; epoch?: string };
};

export function generateMetadata({ params, searchParams }: Props): Metadata {
  const addr = params.addr || "";
  const name = (searchParams.name || "Miner").slice(0, 24);
  const epoch = (searchParams.epoch || "").slice(0, 12);
  const v = searchParams.v || Math.random().toString(36).slice(2);

  const og = new URL("https://basetc.vercel.app/api/og");
  og.searchParams.set("name", name);
  og.searchParams.set("ref", addr);
  if (epoch) og.searchParams.set("epoch", epoch);
  og.searchParams.set("v", v);

  const title = "BaseTC Share";
  const desc = "Personalized share card";

  return {
    title,
    description: desc,
    openGraph: {
      title,
      description: desc,
      images: [{ url: og.toString(), width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: desc,
      images: [og.toString()],
    },
  };
}

export default function SharePage() {
  // tidak perlu render UI — halaman ini hanya untuk meta OG
  return null;
}

