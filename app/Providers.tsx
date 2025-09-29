// app/Providers.tsx
//
// Alasan Perbaikan Final: Memperbaiki error `Module not found` saat build.
// Mengganti import 'FarcasterUserProvider' yang salah menjadi 'FarcasterProvider'
// dengan path yang benar.
"use client";

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "./lib/web3Config";
// -- FIX DI SINI --
import { FarcasterProvider } from "./context/FarcasterProvider";

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {/* -- FIX DI SINI -- */}
        <FarcasterProvider>{children}</FarcasterProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

