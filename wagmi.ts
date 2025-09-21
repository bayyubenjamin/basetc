// wagmi.ts
import { http, createConfig } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { farcaster } from '@farcaster/miniapp-wagmi-connector';

export const config = createConfig({
  chains: [baseSepolia],
  connectors: [
    farcaster(), // <-- Tambahkan konektor Farcaster di sini
  ],
  transports: {
    [baseSepolia.id]: http(),
  },
});
