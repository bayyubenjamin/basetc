import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./Providers";

export const metadata: Metadata = {
  title: "BaseTC Mining",
  description: "A Mini-App NFT Mining Game",
};

export const viewport: Viewport = {
  width: 424,
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0b1118] text-white antialiased">
        {/* Penting: wrapper kanvas */}
        <div className="app-shell">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  );
}

