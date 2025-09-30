// app/head.tsx  (SERVER component, JANGAN pakai "use client")
export default function Head() {
  const embed = {
    version: "1",
    imageUrl: "https://basetc.vercel.app/img/feed.png", // 3:2 (1200x800 dsb)
    button: {
      title: "Open BaseTC",
      action: {
        type: "launch_miniapp",     // atau "launch_frame"
        name: "BaseTC Mini App",
        url: "https://basetc.vercel.app/launch",
        splashImageUrl: "/s.png",    // PNG/JPG 200x200, URL pendek
        splashBackgroundColor: "#0b0b0b",
      },
    },
  };

  return (
    <>
      <meta name="fc:miniapp" content={JSON.stringify(embed)} />
      {/* Optional backward-compat: <meta name="fc:frame" content={JSON.stringify(embed)} /> */}
      <title>BaseTC — Launch</title>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
    </>
  );
}

