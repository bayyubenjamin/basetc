// app/head.tsx
export default function Head() {
  const miniapp = {
    version: "1",
    imageUrl: "https://basetc.vercel.app/img/feed.png", // 3:2 (mis. 1200x800)
    button: {
      title: "Open BaseTC",
      action: {
        type: "launch_miniapp",       // atau "launch_frame"
        name: "BaseTC Mini App",
        url: "https://basetc.vercel.app/launch", // halaman launch-mu
        splashImageUrl: "/s.png",     // 200x200, URL pendek
        splashBackgroundColor: "#0b0b0b"
      }
    }
  };

  return (
    <>
      <meta name="fc:miniapp" content={JSON.stringify(miniapp)} />
      {/* (opsional, backward-compat) */}
      {/* <meta name="fc:frame" content={JSON.stringify(miniapp)} /> */}
      <title>BaseTC</title>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
    </>
  );
}


