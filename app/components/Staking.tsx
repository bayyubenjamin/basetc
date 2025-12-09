"use client";

import { useState, useMemo, useEffect, type FC } from "react";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { base } from "viem/chains";
import { formatEther, parseEther } from "viem";
import { 
  stakingVaultAddress, 
  stakingVaultABI, 
  baseTcAddress, 
  baseTcABI, 
  rigNftABI 
} from "../lib/web3Config";

// --- HELPER UNTUK MENCEGAH CRASH ---
const safeFormat = (value: any): string => {
  try {
    if (value === undefined || value === null) return "0";
    return formatEther(BigInt(value));
  } catch (e) {
    return "0";
  }
};

const Staking: FC = () => {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [amount, setAmount] = useState("");
  const [lockType, setLockType] = useState<0 | 1 | 2>(0);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  // Raw Data States
  const [positionRaw, setPositionRaw] = useState<any>(null);
  const [rewardsRaw, setRewardsRaw] = useState<bigint>(0n);
  const [balanceRaw, setBalanceRaw] = useState<bigint>(0n);
  const [allowanceRaw, setAllowanceRaw] = useState<bigint>(0n);
  
  // NFT States
  const [proCount, setProCount] = useState(0);
  const [legendCount, setLegendCount] = useState(0);

  // --- 1. FETCH DATA YANG AMAN (BUILD FIX) ---
  const fetchData = async () => {
    if (!address || !publicClient) return;

    try {
      // PERBAIKAN UTAMA DI SINI:
      // Menambahkan 'as any' pada penutup kurung kurawal konfigurasi multicall
      // Ini membungkam error "Property authorizationList is missing" saat build Vercel.
      
      const results = await publicClient.multicall({
        contracts: [
          // 0. User Position
          { address: stakingVaultAddress, abi: stakingVaultABI as any, functionName: 'getUser', args: [address] },
          // 1. Pending Reward
          { address: stakingVaultAddress, abi: stakingVaultABI as any, functionName: 'pendingReward', args: [address] },
          // 2. BaseTC Balance
          { address: baseTcAddress, abi: baseTcABI as any, functionName: 'balanceOf', args: [address] },
          // 3. Allowance
          { address: baseTcAddress, abi: baseTcABI as any, functionName: 'allowance', args: [address, stakingVaultAddress] },
          // 4. RigNFT Address
          { address: stakingVaultAddress, abi: stakingVaultABI as any, functionName: 'rigNFT', args: [] },
          // 5. Pro ID
          { address: stakingVaultAddress, abi: stakingVaultABI as any, functionName: 'proId', args: [] },
          // 6. Legend ID
          { address: stakingVaultAddress, abi: stakingVaultABI as any, functionName: 'legendId', args: [] },
        ],
        allowFailure: true 
      } as any); // <--- PENTING: Cast ke 'as any' disini

      // Extract Data dengan aman (Cek status success)
      // Karena kita cast 'as any' diatas, TypeScript mungkin menganggap results sebagai 'any'.
      // Kita akses manual.
      const resArray = results as any[];

      if (resArray[0].status === 'success') setPositionRaw(resArray[0].result);
      if (resArray[1].status === 'success') setRewardsRaw(BigInt(resArray[1].result as any));
      if (resArray[2].status === 'success') setBalanceRaw(BigInt(resArray[2].result as any));
      if (resArray[3].status === 'success') setAllowanceRaw(BigInt(resArray[3].result as any));

      // Fetch NFT logic
      const rigAddr = resArray[4].status === 'success' ? resArray[4].result as string : null;
      const proId = resArray[5].status === 'success' ? resArray[5].result : null;
      const legendId = resArray[6].status === 'success' ? resArray[6].result : null;

      if (rigAddr && rigAddr !== "0x0000000000000000000000000000000000000000") {
          fetchNftData(rigAddr, proId, legendId);
      }

    } catch (e) {
      console.error("Fetch Error:", e);
    }
  };

  const fetchNftData = async (rigAddr: any, proId: any, legendId: any) => {
      if(!publicClient || !address) return;
      try {
        // Tambahkan 'as any' disini juga untuk keamanan build
        const nftRes = await publicClient.multicall({
            contracts: [
                { address: rigAddr, abi: rigNftABI as any, functionName: 'balanceOf', args: [address, proId] },
                { address: rigAddr, abi: rigNftABI as any, functionName: 'balanceOf', args: [address, legendId] },
            ],
            allowFailure: true
        } as any) as any[]; // Cast hasil juga ke array

        if(nftRes[0].status === 'success') setProCount(Number(nftRes[0].result));
        if(nftRes[1].status === 'success') setLegendCount(Number(nftRes[1].result));
      } catch (err) { console.warn("NFT Fail", err); }
  }

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Refresh tiap 10 detik
    return () => clearInterval(interval);
  }, [address]);

  // --- 2. CALCULATIONS (SAFE MODE) ---
  const stakedAmount = useMemo(() => {
    if (!positionRaw) return 0;
    
    try {
      let tranches: any[] = [];
      
      // Deteksi bentuk data
      if (Array.isArray(positionRaw)) {
        if (Array.isArray(positionRaw[0])) tranches = positionRaw[0];
        else tranches = positionRaw; 
      } else if (positionRaw.tranches) {
        tranches = positionRaw.tranches;
      }

      if (!Array.isArray(tranches)) return 0;

      const total = tranches.reduce((sum, item) => {
        const val = item?.amount !== undefined ? item.amount : (Array.isArray(item) ? item[0] : 0n);
        return sum + BigInt(val || 0n);
      }, 0n);

      return Number(formatEther(total));
    } catch (e) {
      console.error("Calc error:", e);
      return 0;
    }
  }, [positionRaw]);

  const rewardsDisplay = useMemo(() => {
     return Number(formatEther(rewardsRaw || 0n));
  }, [rewardsRaw]);

  // --- 3. ACTIONS ---
  const handleStake = async () => {
    if (!address) return;
    setLoading(true);
    setStatus("Processing...");
    try {
        const val = parseEther(amount || "0");
        if (allowanceRaw < val) {
            setStatus("Approving...");
            const tx = await writeContractAsync({
                address: baseTcAddress,
                abi: baseTcABI as any,
                functionName: 'approve',
                args: [stakingVaultAddress, val],
                chain: base
            } as any);
            await publicClient?.waitForTransactionReceipt({ hash: tx });
            setAllowanceRaw(val);
        }
        
        setStatus("Staking...");
        const txStake = await writeContractAsync({
            address: stakingVaultAddress,
            abi: stakingVaultABI as any,
            functionName: 'stake',
            args: [val, lockType],
            chain: base
        } as any);
        await publicClient?.waitForTransactionReceipt({ hash: txStake });
        
        setStatus("Success!");
        setAmount("");
        fetchData();
        setTimeout(fetchData, 3000);

    } catch (e: any) {
        setStatus("Failed: " + (e.shortMessage || "Error"));
    } finally {
        setLoading(false);
    }
  };

  const handleUnstake = async () => {
      if (!address || !positionRaw) return;
      setLoading(true);
      try {
        let tranches: any[] = [];
        if (Array.isArray(positionRaw)) {
            tranches = Array.isArray(positionRaw[0]) ? positionRaw[0] : positionRaw;
        } else if (positionRaw.tranches) {
            tranches = positionRaw.tranches;
        }
        
        const active = tranches.map((t: any, i: number) => {
            const val = t?.amount !== undefined ? t.amount : (Array.isArray(t) ? t[0] : 0n);
            return { i, val: BigInt(val) };
        }).filter(x => x.val > 0n);

        if(active.length === 0) throw new Error("Nothing to unstake");

        const tx = await writeContractAsync({
            address: stakingVaultAddress,
            abi: stakingVaultABI as any,
            functionName: 'unstake',
            args: [active.map(x => x.i), active.map(x => x.val)],
            chain: base
        } as any);
        
        setStatus("Unstaking...");
        await publicClient?.waitForTransactionReceipt({ hash: tx });
        setStatus("Unstake Success!");
        fetchData();
      } catch (e: any) {
          setStatus("Error: " + e.shortMessage);
      } finally {
          setLoading(false);
      }
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <div className="space-y-6 rounded-lg bg-white p-6 border border-gray-300 shadow-md">
        <h2 className="text-lg font-bold text-center">Staking Dashboard</h2>

        {/* --- DISPLAY UTAMA --- */}
        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="p-2 bg-gray-50 rounded">
            <p className="text-sm text-gray-500">My Staked</p>
            <p className="text-xl font-bold text-blue-600">
                {stakedAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
            </p>
          </div>
          <div className="p-2 bg-gray-50 rounded">
            <p className="text-sm text-gray-500">Pending Rewards</p>
            <p className="text-xl font-bold text-green-600">
                {rewardsDisplay.toFixed(6)}
            </p>
          </div>
        </div>

        {/* INPUT FORM */}
        <div className="space-y-2">
            <div className="flex justify-between text-xs text-gray-500">
                <span>Stake Amount</span>
                <span>Bal: {formatEther(balanceRaw)}</span>
            </div>
            <input 
                type="number" 
                value={amount} 
                onChange={e => setAmount(e.target.value)}
                className="w-full border p-2 rounded"
                placeholder="0.0"
            />
        </div>

        {/* LOCK OPTIONS */}
        <div className="flex gap-2">
            {[
                { l: "30D", v: 0 }, { l: "90D", v: 1 }, { l: "365D", v: 2 }
            ].map((opt: any) => (
                <button 
                    key={opt.v}
                    onClick={() => setLockType(opt.v)}
                    className={`flex-1 py-1 text-xs rounded ${lockType === opt.v ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                >
                    {opt.l}
                </button>
            ))}
        </div>

        {/* BUTTONS */}
        <div className="grid grid-cols-2 gap-2">
            <button 
                onClick={handleStake}
                disabled={loading}
                className="bg-green-600 text-white py-2 rounded disabled:opacity-50"
            >
                {loading ? '...' : 'Stake'}
            </button>
            <button 
                onClick={handleUnstake}
                disabled={loading}
                className="bg-red-500 text-white py-2 rounded disabled:opacity-50"
            >
                {loading ? '...' : 'Unstake'}
            </button>
        </div>

        {status && <p className="text-center text-xs mt-2">{status}</p>}
      </div>
    </div>
  );
};

export default Staking;
