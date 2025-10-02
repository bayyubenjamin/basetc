// app/launch/head.tsx
export default function Head() {
  const payload = {
    version: "1",
    imageUrl: "https://basetc.xyz/img/feed.png",
    button: {
      title: "Open BaseTC",
      action: {
        type: "launch_miniapp",
        name: "BaseTC Console",
        url: "https://basetc.xyz/launch", // HARUS persis sama dengan homeUrl
        splashImageUrl: "https://basetc.xyz/s.png",
        splashBackgroundColor: "#FFFFFF",
      },
    },
  };

  const payloadJson = JSON.stringify(payload);

  return (
    <>
      {/* OG/Twitter (boleh duplikat dari layout, aman) */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content="https://basetc.xyz/launch" />
      <meta property="og:title" content="BaseTC Console" />
      <meta property="og:description" content="Start mining with a free Basic rig onchain." />
      <meta property="og:image" content="https://basetc.xyz/img/feed.png" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="BaseTC Console" />
      <meta name="twitter:description" content="Start mining with a free Basic rig onchain." />
      <meta name="twitter:image" content="https://basetc.xyz/img/feed.png" />

      {/* ⭐️ Inilah yang dicari unfurler Farcaster */}
      <meta name="fc:miniapp" content={payloadJson} />
      <meta name="fc:frame" content={payloadJson} />
      {/* (opsional) tanda kompatibilitas legacy */}
      <meta name="fc:frame-legacy" content="1" />
    </>
  );
}

