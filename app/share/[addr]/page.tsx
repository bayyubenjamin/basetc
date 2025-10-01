// app/share/[addr]/page.tsx
import type { Metadata, ResolvingMetadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { params: { addr: string }, searchParams?: Record<string, string | string[] | undefined> };

function abs(url: string) {
  // pastikan absolute URL (bukan relative), wajib untuk Farcaster
  try {
    const hdrs = headers();
    const host = hdrs.get("x-forwarded-host") || hdrs.get("host") || "";
    const proto = (hdrs.get("x-forwarded-proto") || "https").split(",")[0];
    const base = `${proto}://${host}`;
    return url.startsWith("http") ? url : `${base}${url}`;
  } catch {
    return url;
  }
}

export async function generateMetadata(
  { params }: Props,
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const addr = params.addr;
  if (!addr || !addr.startsWith("0x") || addr.length !== 42) {
    return { title: "Share · BaseTC", robots: { index: false } };
  }

  // Build image URL (3:2) dengan data dinamis
  const name = "Miner";            // boleh kamu ganti kalau punya context user server-side
  const fid = "";                  // opsional: inject kalau ada
  const epoch = "";                // opsional: inject kalau ada
  const v = Date.now().toString(36);

  const imgUrl = abs(
    `/api/og?ref=${encodeURIComponent(addr)}${fid ? `&fid=${fid}` : ""}&name=${encodeURIComponent(name)}${epoch ? `&epoch=${epoch}` : ""}&v=${v}`
  );

  const launchUrl = abs("/launch");

  const miniapp = {
    version: "1",
    imageUrl: imgUrl,
    button: {
      title: "Open BaseTC",
      action: {
        type: "launch_miniapp",
        name: "BaseTC Console",
        url: launchUrl,
        splashImageUrl: abs("/s.png"),
        splashBackgroundColor: "#FFFFFF",
      },
    },
  };

  return {
    title: "BaseTC Share",
    description: "Personalized BaseTC embed.",
    // OG/Twitter fallback (tidak dipakai Mini Apps, tapi aman untuk klien lain)
    openGraph: {
      images: [{ url: imgUrl, width: 1500, height: 1000 }],
    },
    twitter: {
      card: "summary_large_image",
      images: [imgUrl],
    },
    other: {
      "fc:miniapp": JSON.stringify(miniapp),
      "fc:frame": JSON.stringify({ ...miniapp, button: { ...miniapp.button, action: { ...miniapp.button.action, type: "launch_frame" } } }),
    },
  };
}

export default function SharePage({ params }: Props) {
  const { addr } = params;
  if (!addr || !addr.startsWith("0x") || addr.length !== 42) {
    notFound();
  }
  // Halaman bisa kosong; yang penting HEAD metanya di-generate
  return (
    <main style={{ padding: 24, color: "#9CA3AF" }}>
      <p>Share page ready. You can close this tab.</p>
    </main>
  );
}

