// app/Providers.tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { config } from "../wagmi";
import type { ReactNode } from "react";

// Instantiate a single QueryClient for the application. React Query
// manages caching and mutation states for async calls (like contract
// interactions). Creating it outside of the component ensures the
// client isn't recreated on every render.
const queryClient = new QueryClient();

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {/* WagmiProvider exposes hooks like useAccount, useWriteContract,
          and useReadContract to any descendant components. */}
      <WagmiProvider config={config}>{children}</WagmiProvider>
    </QueryClientProvider>
  );
}