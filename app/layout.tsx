import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./Providers"; // <-- 1. Impor provider baru

// Metadata bisa disesuaikan
export const metadata: Metadata = {
  title: "BaseTC Mining",
  description: "A Mini-App NFT Mining Game",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* Menghapus className font dari body untuk menghindari error jika 
        font tidak dikonfigurasi. Anda bisa menambahkannya kembali jika perlu.
      */}
      <body>
        <Providers> {/* <-- 2. Bungkus children dengan provider yang benar */}
          {children}
        </Providers>
      </body>
    </html>
  );
}
