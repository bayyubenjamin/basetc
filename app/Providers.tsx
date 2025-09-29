// app/Providers.tsx
//
// Alasan Perbaikan Final: Memperbaiki error `Module not found` dan `is not exported`.
// Mengganti import 'wagmiConfig' yang salah menjadi 'config' dari './lib/web3Config'
// yang merupakan path dan nama ekspor yang benar.
"use client";

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
// --- FIX DI SINI ---
import { config } from "./lib/web3Config"; // Mengimpor 'config' yang diekspor

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
