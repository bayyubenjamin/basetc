// app/head.tsx  (SERVER COMPONENT, jangan "use client")
export default function Head() {
  const embed = {
    version: "1",
    imageUrl: "https://basetc.vercel.app/img/feed.png", // 3:2 (mis. 1200x800)
    button: {
      title: "Open BaseTC",
      action: {
        type: "launch_miniapp",        // atau "launch_frame"
        name: "BaseTC Mini App",
        url: "https://basetc.vercel.app/launch",
        splashImageUrl: "/s.png",       // PNG/JPG 200x200, URL pendek (≤32 char)
        splashBackgroundColor: "#0b0b0b"
      }
    }
  };

  return (
    <>
      <meta name="fc:miniapp" content={JSON.stringify(embed)} />
      {/* (opsional) backward-compat */}
      {/* <meta name="fc:frame" content={JSON.stringify(embed)} /> */}
      <title>BaseTC — Launch</title>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
    </>
  );
}

