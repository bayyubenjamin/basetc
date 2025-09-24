"use client";

import { createContext, useContext, useMemo, useEffect, useState, type ReactNode } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  usePublicClient,
  useWalletClient,
} from "wagmi";
import { getContract, type PublicClient, type WalletClient } from "viem";
import {
  gameCoreAddress,
  gameCoreABI,
  rigNftAddress,
  rigNftABI,
  baseTcAddress,
  baseTcABI,
} from "../lib/web3Config";

type Addr = `0x${string}`;

interface Web3ContextType {
  /** viem public client (read) */
  provider: PublicClient | null;
  /** viem wallet client (write) */
  signer: WalletClient | null;
  /** connected address */
  account: Addr | null;

  /** viem contract instances (read/write tergantung client yang tersedia) */
  gameCoreContract: any | null;
  rigNftContract: any | null;
  baseTcContract: any | null;

  /** connect/disconnect via Farcaster wagmi connector */
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;

  /** state */
  isLoading: boolean;
  isConnected: boolean;
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

export function Web3Provider({ children }: { children: ReactNode }) {
  // wagmi states
  const publicClient = usePublicClient();                 // viem PublicClient (read)
  const { data: walletClient } = useWalletClient();       // viem WalletClient (write)
  const { address, isConnected } = useAccount();
  const { connectAsync, connectors, isPending: isConnecting } = useConnect();
  const { disconnectAsync } = useDisconnect();

  const [isLoading, setIsLoading] = useState(false);

  /** Connect specifically using Farcaster connector (atau fallback ke connector pertama) */
  const connectWallet = async () => {
    setIsLoading(true);
    try {
      if (isConnected) return;
      const farcaster =
        connectors.find(
          (c) =>
            c.id?.toLowerCase?.().includes("farcaster") ||
            c.name?.toLowerCase?.().includes("farcaster")
        ) ?? connectors[0];

      if (!farcaster) {
        throw new Error("Tidak ada connector wagmi yang tersedia.");
      }
      await connectAsync({ connector: farcaster });
    } finally {
      setIsLoading(false);
    }
  };

  const disconnectWallet = async () => {
    await disconnectAsync();
  };

  /** Contract helpers — otomatis pakai walletClient jika ada (bisa write), kalau tidak pakai publicClient (read) */
  const gameCoreContract = useMemo(() => {
    if (!publicClient) return null;
    const client = (walletClient ?? publicClient) as any;
    return getContract({
      address: gameCoreAddress as Addr,
      abi: gameCoreABI as any,
      client,
    });
  }, [publicClient, walletClient]);

  const rigNftContract = useMemo(() => {
    if (!publicClient) return null;
    const client = (walletClient ?? publicClient) as any;
    return getContract({
      address: rigNftAddress as Addr,
      abi: rigNftABI as any,
      client,
    });
  }, [publicClient, walletClient]);

  const baseTcContract = useMemo(() => {
    if (!publicClient) return null;
    const client = (walletClient ?? publicClient) as any;
    return getContract({
      address: baseTcAddress as Addr,
      abi: baseTcABI as any,
      client,
    });
  }, [publicClient, walletClient]);

  // (Opsional) Auto-connect saat mount agar UX sama seperti versi sebelumnya.
  useEffect(() => {
    // Jangan spam kalau sudah connect / sedang connect
    if (!isConnected && !isConnecting) {
      void connectWallet().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value: Web3ContextType = {
    provider: publicClient ?? null,
    signer: walletClient ?? null,
    account: (address ?? null) as Addr | null,
    gameCoreContract,
    rigNftContract,
    baseTcContract,
    connectWallet,
    disconnectWallet,
    isLoading: isLoading || isConnecting,
    isConnected,
  };

  return <Web3Context.Provider value={value}>{children}</Web3Context.Provider>;
}

export function useWeb3() {
  const ctx = useContext(Web3Context);
  if (!ctx) throw new Error("useWeb3 must be used within a Web3Provider");
  return ctx;
}

