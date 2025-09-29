// app/layout.tsx
//
// Alasan: Membungkus aplikasi dengan FarcasterProvider yang baru,
// memastikan state FID dan user profile tersedia secara global.
// Menghapus Web3Provider yang lama karena fungsionalitasnya sudah terintegrasi
// lebih baik dengan wagmi's Providers.
import "./globals.css";
import type { Metadata } from "next";
import React from "react";
import { Providers } from "./Providers";
import { FarcasterProvider } from "./context/FarcasterProvider";

export const metadata: Metadata = {
  title: "BaseTC MiniApp",
  description: "Farcaster mining console built with Next.js and Tailwind.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <Providers>
          <FarcasterProvider>{children}</FarcasterProvider>
        </Providers>
      </body>
    </html>
  );
}

