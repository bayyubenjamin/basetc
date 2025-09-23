// app/Providers.tsx
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OnchainKitProvider } from "@coinbase/onchainkit";
import { WagmiProvider } from "wagmi";
import { config } from "../wagmi";
import { baseSepolia } from "wagmi/chains";
import { ReactNode } from "react";

const queryClient = new QueryClient();

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <OnchainKitProvider chain={baseSepolia}>
        <WagmiProvider config={config}>{children}</WagmiProvider>
      </OnchainKitProvider>
    </QueryClientProvider>
  );
}

