// app/launch/layout.tsx
export const metadata = {
  other: {
    "fc:miniapp": JSON.stringify({
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
    }),
  },
  title: "BaseTC — Launch",
  viewport: "width=device-width, initial-scale=1",
} as const;

export default function LaunchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // NOTE: JANGAN "use client" di layout
  return <>{children}</>;
}

