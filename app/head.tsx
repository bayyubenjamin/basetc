// app/head.tsx
export default function Head() {
  // Embed untuk Farcaster: HARUS muncul di <head> (SSR), bukan di client
  const miniapp = {
    version: "1",
    imageUrl: "https://basetc.vercel.app/img/feed.png", // rasio 3:2 (mis. 1200x800)
    button: {
      title: "Open BaseTC",
      action: {
        type: "launch_miniapp", // boleh "launch_frame"
        name: "BaseTC Mini App",
        url: "https://basetc.vercel.app/launch",
        splashImageUrl: "/s.png", // PNG/JPG 200x200, URL pendek (≤32 char)
        splashBackgroundColor: "#0b0b0b"
      }
    }
  };

  return (
    <>
      <meta name="fc:miniapp" content={JSON.stringify(miniapp)} />
      {/* (opsional) backward-compat untuk klien lama */}
      {/* <meta name="fc:frame" content={JSON.stringify(miniapp)} /> */}

      <title>BaseTC</title>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
    </>
  );
}

