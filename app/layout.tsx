/*
 * Root layout for the BaseTC mini app.
 *
 * This layout wraps all pages and ensures that Tailwind styles are applied
 * consistently across the application. The dark background and light text
 * provide good contrast for a mobile‑first mining console interface.
 */

import "./globals.css";
import type { Metadata } from "next";
import React from "react";
import { Providers } from "./Providers";

export const metadata: Metadata = {
  title: 'BaseTC MiniApp',
  description: 'Farcaster mining console built with Next.js and Tailwind.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        {/* Wrap all pages in our Providers component to supply wagmi,
            OnchainKit and React Query contexts. This does not alter the
            visual design but enables web3 functionality. */}
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}