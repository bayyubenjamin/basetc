// app/share/[addr]/page.tsx
import type { Metadata } from "next";

type Props = {
  params: { addr: string };
};

// metadata dinamis
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const addr = params.addr;
  return {
    title: `BaseTC Invite - ${addr.slice(0, 6)}…${addr.slice(-4)}`,
    description: "Start mining with a free Basic rig on BaseTC Console.",
    openGraph: {
      title: "BaseTC Console",
      description: "Claim your free rig and start mining.",
      images: [
        {
          url: `https://basetc.vercel.app/api/og?user=${addr}`, // arahkan ke OG API dinamis
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "BaseTC Console",
      description: "Claim your free rig and start mining.",
      images: [`https://basetc.vercel.app/api/og?user=${addr}`],
    },
  };
}

export default function SharePage({ params }: Props) {
  const { addr } = params;
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white">
      <h1 className="text-2xl font-bold">BaseTC Invite</h1>
      <p className="mt-2">Referral address:</p>
      <code className="mt-1 px-2 py-1 bg-neutral-800 rounded">{addr}</code>
      <a
        href="/launch"
        className="mt-6 px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500"
      >
        Open App
      </a>
    </div>
  );
}

