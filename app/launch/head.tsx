// app/launch/head.tsx
export default function Head() {
  const embed = {
    version: "1",
    imageUrl: "https://basetc.vercel.app/img/feed.png",
    button: {
      title: "Open BaseTC",
      action: {
        type: "launch_miniapp",
        name: "BaseTC Mini App",
        url: "https://basetc.vercel.app/launch",
        splashImageUrl: "/s.png",
        splashBackgroundColor: "#0b0b0b",
      },
    },
  };

  return (
    <>
      <meta name="fc:miniapp" content={JSON.stringify(embed)} />
      <title>BaseTC — Launch</title>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
    </>
  );
}

