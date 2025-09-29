"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { config } from "../wagmi";
import type { ReactNode } from "react";
import { FarcasterUserProvider } from "./context/FarcasterUserProvider"; // Impor provider baru

const queryClient = new QueryClient();

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <FarcasterUserProvider> {/* Bungkus children dengan provider baru */}
          {children}
        </FarcasterUserProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
