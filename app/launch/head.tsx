// app/launch/head.tsx
export default function Head() {
  const miniapp = {
    version: "1",
    imageUrl: "https://basetc.xyz/img/feed.png",
    button: {
      title: "Open BaseTC",
      action: {
        type: "launch_miniapp",
        name: "BaseTC Console",
        url: "https://basetc.xyz/launch",
        splashImageUrl: "/s.png",
        splashBackgroundColor: "#FFFFFF"
      }
    }
  };

  return (
    <>
      <meta name="fc:miniapp" content={JSON.stringify(miniapp)} />
      <title>BaseTC — Launch</title>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
    </>
  );
}

