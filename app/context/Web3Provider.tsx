"use client";
import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { ethers } from 'ethers';
import { gameCoreAddress, gameCoreABI, rigNftAddress, rigNftABI, baseTcAddress, baseTcABI } from '../lib/web3Config';

// Tipe untuk data yang akan kita sediakan
interface Web3ContextType {
  provider: ethers.BrowserProvider | null;
  signer: ethers.Signer | null;
  account: string | null;
  gameCoreContract: ethers.Contract | null;
  rigNftContract: ethers.Contract | null;
  baseTcContract: ethers.Contract | null;
  connectWallet: () => Promise<void>;
  isLoading: boolean;
}

// Buat Context
const Web3Context = createContext<Web3ContextType | undefined>(undefined);

// Buat Provider Component
export function Web3Provider({ children }: { children: ReactNode }) {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [gameCoreContract, setGameCoreContract] = useState<ethers.Contract | null>(null);
  const [rigNftContract, setRigNftContract] = useState<ethers.Contract | null>(null);
  const [baseTcContract, setBaseTcContract] = useState<ethers.Contract | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        setIsLoading(true);
        const web3Provider = new ethers.BrowserProvider(window.ethereum);
        setProvider(web3Provider);

        const accounts = await web3Provider.send("eth_requestAccounts", []);
        if (accounts.length > 0) {
          const signer = await web3Provider.getSigner();
          setSigner(signer);
          setAccount(accounts[0]);

          // Inisialisasi kontrak
          setGameCoreContract(new ethers.Contract(gameCoreAddress, gameCoreABI, signer));
          setRigNftContract(new ethers.Contract(rigNftAddress, rigNftABI, signer));
          setBaseTcContract(new ethers.Contract(baseTcAddress, baseTcABI, signer));
        }
      } catch (error) {
        console.error("Failed to connect wallet:", error);
      } finally {
        setIsLoading(false);
      }
    } else {
      alert("Please install MetaMask!");
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    connectWallet(); // Coba konek saat pertama kali load
  }, []);

  return (
    <Web3Context.Provider value={{ provider, signer, account, gameCoreContract, rigNftContract, baseTcContract, connectWallet, isLoading }}>
      {children}
    </Web3Context.Provider>
  );
}

// Buat custom hook untuk kemudahan penggunaan
export function useWeb3() {
  const context = useContext(Web3Context);
  if (context === undefined) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  return context;
}
