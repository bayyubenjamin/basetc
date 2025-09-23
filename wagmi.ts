// wagmi.ts
//
// This configuration sets up wagmi for the Base Sepolia testnet and
// integrates the Farcaster miniapp connector. The farcaster connector
// allows the BaseTC mini app to interact with a Farcaster frame when
// running inside the Farcaster environment. The HTTP transport is
// configured for general RPC access. See wagmi documentation for
// additional configuration options.

import { http, createConfig } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import farcaster from "@farcaster/miniapp-wagmi-connector";

// Create the wagmi configuration with the Base Sepolia chain and the
// Farcaster connector. Additional connectors (e.g. MetaMask) can be
// added here if you plan to support other wallets in the future.
export const config = createConfig({
  chains: [baseSepolia],
  connectors: [farcaster()],
  transports: {
    [baseSepolia.id]: http(),
  },
});