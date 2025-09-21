// wagmi.ts
import { http, createConfig } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import farcaster from '@farcaster/miniapp-wagmi-connector'; // <-- PERBAIKAN: Hapus kurung kurawal {}

export const config = createConfig({
  chains: [baseSepolia],
  connectors: [
    farcaster(), 
  ],
  transports: {
    [baseSepolia.id]: http(),
  },
});
