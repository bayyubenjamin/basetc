// app/head.tsx
export default function Head() {
  const embed = {
    version: "1",
    imageUrl: "https://basetc.vercel.app/img/feed.png", // rasio 3:2
    button: {
      title: "Open BaseTC",
      action: {
        type: "launch_miniapp",
        name: "BaseTC Mini App",
        url: "https://basetc.vercel.app/launch",
        splashImageUrl: "/s.png",      // PNG/JPG 200x200, URL pendek
        splashBackgroundColor: "#0b0b0b",
      },
    },
  };

  return (
    <>
      <meta name="fc:miniapp" content={JSON.stringify(embed)} />
      {/* optional legacy: <meta name="fc:frame" content={JSON.stringify(embed)} /> */}
      <title>BaseTC — Launch</title>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
    </>
  );
}

