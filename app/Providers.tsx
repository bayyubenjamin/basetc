// app/Providers.tsx
"use client";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { WagmiProvider } from 'wagmi';
import { config } from '../wagmi';
import { baseSepolia } from 'wagmi/chains'; // <-- TAMBAHKAN BARIS INI

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <OnchainKitProvider
          apiKey="b712d16f-116b-4321-81b6-fdffbe277957" // Ganti dengan API Key Anda dari OnchainKit
          chain={baseSepolia}
        >
          {children}
        </OnchainKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
