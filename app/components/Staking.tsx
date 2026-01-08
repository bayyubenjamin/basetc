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

// --- CONFIG ---
const MAX_PRO = 5;
const MAX_LEGEND = 3;
const BOOST_CAP = 50; // %

const Staking: FC = () => {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  // Input State
  const [amount, setAmount] = useState("");
  const [lockType, setLockType] = useState<0 | 1 | 2>(0);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  // Data State
  const [positionRaw, setPositionRaw] = useState<any>(null);
  const [rewardsRaw, setRewardsRaw] = useState<bigint>(0n);
  const [balanceRaw, setBalanceRaw] = useState<bigint>(0n);
  const [allowanceRaw, setAllowanceRaw] = useState<bigint>(0n);
  
  // NFT State
  const [proCount, setProCount] = useState(0);
  const [legendCount, setLegendCount] = useState(0);

  // --- NEW: State Waktu untuk Tabel ---
  const [currentTime, setCurrentTime] = useState(Math.floor(Date.now() / 1000));

  // --- 1. FETCH DATA ---
  const fetchData = async () => {
    if (!address || !publicClient) return;

    try {
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
      } as any);

      const resArray = results as any[];

      if (resArray[0].status === 'success') setPositionRaw(resArray[0].result);
      if (resArray[1].status === 'success') setRewardsRaw(BigInt(resArray[1].result || 0));
      if (resArray[2].status === 'success') setBalanceRaw(BigInt(resArray[2].result || 0));
      if (resArray[3].status === 'success') setAllowanceRaw(BigInt(resArray[3].result || 0));

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
        const nftRes = await publicClient.multicall({
            contracts: [
                { address: rigAddr, abi: rigNftABI as any, functionName: 'balanceOf', args: [address, proId] },
                { address: rigAddr, abi: rigNftABI as any, functionName: 'balanceOf', args: [address, legendId] },
            ],
            allowFailure: true
        } as any);

        const resArray = nftRes as any[];
        if(resArray[0].status === 'success') setProCount(Number(resArray[0].result));
        if(resArray[1].status === 'success') setLegendCount(Number(resArray[1].result));
      } catch (err) { console.warn("NFT Fail", err); }
  }

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); 
    const timeInterval = setInterval(() => setCurrentTime(Math.floor(Date.now() / 1000)), 60000);

    return () => {
        clearInterval(interval);
        clearInterval(timeInterval);
    };
  }, [address]);

  // --- 2. CALCULATIONS ---
  const stakedAmount = useMemo(() => {
    if (!positionRaw || !Array.isArray(positionRaw)) return "0";
    const tranchesData = positionRaw[4];
    if (!Array.isArray(tranchesData)) return "0";

    try {
        const total = tranchesData.reduce((sum: bigint, t: any) => {
            if (!t) return sum;
            let val = 0n;
            if (t.amount !== undefined) val = BigInt(t.amount);
            else if (Array.isArray(t) && t[0] !== undefined) val = BigInt(t[0]);
            return sum + val;
        }, 0n);
        return formatEther(total);
    } catch (e) {
        return "0";
    }
  }, [positionRaw]);

  // --- FIX: Map Tranches dengan Index Asli ---
  const tranchesList = useMemo(() => {
    if (!positionRaw || !Array.isArray(positionRaw) || !Array.isArray(positionRaw[4])) return [];
    
    // Kita map dulu untuk menyimpan index asli (i) sebelum di-filter
    return positionRaw[4]
      .map((t: any, index: number) => {
          const amt = t?.amount !== undefined ? BigInt(t.amount) : (Array.isArray(t) ? BigInt(t[0]) : 0n);
          // Asumsi struktur struct/tuple: [amount, lockUntil, ...]
          const lockTime = t?.lockUntil !== undefined ? Number(t.lockUntil) : (Array.isArray(t) ? Number(t[1]) : 0);
          
          return {
              originalIndex: index, // PENTING: Index array asli untuk argumen contract
              amount: amt,
              lockUntil: lockTime
          };
      })
      .filter((item: any) => item.amount > 0n); // Hanya tampilkan yang aktif
  }, [positionRaw]);

  const formatUnlockDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString("id-ID", { 
        day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute:"2-digit" 
    });
  };

  const rewardsDisplay = useMemo(() => {
     return rewardsRaw ? formatEther(rewardsRaw) : "0";
  }, [rewardsRaw]);

  const boostPercent = useMemo(() => {
    const pro = Math.min(proCount, MAX_PRO);
    const legend = Math.min(legendCount, MAX_LEGEND);
    return Math.min((pro * 5) + (legend * 8), BOOST_CAP);
  }, [proCount, legendCount]);

  // --- 3. ACTIONS ---
  
  // A. Claim Rewards (Bunga) Only
  const handleClaimRewards = async () => {
    if (!address) return;
    setLoading(true);
    setStatus("Claiming rewards...");
    try {
        const tx = await writeContractAsync({
            address: stakingVaultAddress,
            abi: stakingVaultABI as any,
            functionName: 'claim',
            args: [],
            chain: base
        } as any);
        await publicClient?.waitForTransactionReceipt({ hash: tx });
        setStatus("Rewards Claimed!");
        fetchData();
    } catch (e: any) {
        setStatus("Claim Failed: " + (e.shortMessage || e.message));
    } finally {
        setLoading(false);
    }
  };

  // B. Stake Baru
  const handleStake = async () => {
    if (!address) return;
    setLoading(true);
    setStatus("Processing Stake...");

    try {
        const val = parseEther(amount || "0");
        if (val <= 0n) throw new Error("Amount > 0");
        
        if (allowanceRaw < val) {
            setStatus("Approving BaseTC...");
            const txApprove = await writeContractAsync({
                address: baseTcAddress,
                abi: baseTcABI as any,
                functionName: 'approve',
                args: [stakingVaultAddress, val],
                chain: base
            } as any);
            await publicClient?.waitForTransactionReceipt({ hash: txApprove });
            setAllowanceRaw(val);
        }

        setStatus("Staking...");
        const tx = await writeContractAsync({
            address: stakingVaultAddress,
            abi: stakingVaultABI as any,
            functionName: 'stake',
            args: [val, lockType],
            chain: base
        } as any);
        await publicClient?.waitForTransactionReceipt({ hash: tx });

        setStatus("Staking Success!");
        setAmount("");
        fetchData(); 
    } catch (e: any) {
        setStatus("Stake Failed: " + (e.shortMessage || e.message));
    } finally {
        setLoading(false);
    }
  };

  // C. Unstake Satuan (Principal)
  const handleUnstakeSingle = async (originalIndex: number, amountVal: bigint) => {
      if (!address) return;
      setLoading(true);
      setStatus("Unstaking...");

      try {
          // Unstake hanya 1 item, tapi contract butuh Array
          const tx = await writeContractAsync({
              address: stakingVaultAddress,
              abi: stakingVaultABI as any,
              functionName: 'unstake',
              args: [[originalIndex], [amountVal]], // Kirim Array of Index & Array of Amount
              chain: base
          } as any);
          await publicClient?.waitForTransactionReceipt({ hash: tx });
          
          setStatus("Unstake Success!");
          fetchData();
      } catch (e: any) {
          setStatus("Unstake Failed: " + (e.shortMessage || e.message));
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="max-w-md mx-auto p-4">
      <div className="space-y-6 rounded-lg bg-white p-6 border border-gray-300 shadow-md relative">
        
        {/* Header */}
        <div className="relative mb-4">
            <h2 className="text-lg font-bold text-gray-800 text-center">Staking Dashboard</h2>
            <button 
                onClick={fetchData} 
                className="absolute right-0 top-0 text-xs text-blue-500 hover:text-blue-700 underline"
            >
                Refresh
            </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500 mb-1">My Staked</p>
            <p className="text-xl font-bold text-blue-600 truncate">
                {Number(stakedAmount).toLocaleString(undefined, { maximumFractionDigits: 4 })}
            </p>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg relative">
            <p className="text-sm text-gray-500 mb-1">Pending Rewards</p>
            <p className="text-xl font-bold text-green-600 truncate">
                {Number(rewardsDisplay).toFixed(6)}
            </p>
            {rewardsRaw > 0n && (
                <button 
                    onClick={handleClaimRewards}
                    disabled={loading}
                    className="mt-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200 w-full font-semibold border border-green-200"
                >
                    {loading ? "..." : "Claim Rewards"}
                </button>
            )}
          </div>
        </div>

        {/* NFT Boost */}
        <div className="grid grid-cols-3 gap-2 text-center border-t border-b py-3 bg-blue-50/50 rounded-md">
            <div>
                <p className="text-xs text-gray-500">Pro NFT</p>
                <p className="font-bold text-gray-800">{proCount}</p>
            </div>
            <div>
                <p className="text-xs text-gray-500">Legend NFT</p>
                <p className="font-bold text-gray-800">{legendCount}</p>
            </div>
            <div>
                <p className="text-xs text-gray-500">Boost</p>
                <p className="font-bold text-green-600">+{boostPercent}%</p>
            </div>
        </div>

        {/* Form Staking */}
        <div className="space-y-3 mt-4">
            <div className="flex justify-between text-xs text-gray-500 px-1">
                <span>Stake Amount</span>
                <span>Bal: {balanceRaw ? Number(formatEther(balanceRaw)).toFixed(4) : "0"}</span>
            </div>
            <input 
                type="number" 
                value={amount} 
                onChange={e => setAmount(e.target.value)}
                className="w-full border border-gray-300 p-3 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="0.0"
                disabled={loading}
            />
        </div>

        {/* Lock Duration */}
        <div className="flex gap-2">
            {[
                { l: "30D", v: 0 }, { l: "90D", v: 1 }, { l: "365D", v: 2 }
            ].map((opt: any) => (
                <button 
                    key={opt.v}
                    onClick={() => setLockType(opt.v)}
                    disabled={loading}
                    className={`flex-1 py-2 text-xs font-semibold rounded transition-colors ${
                        lockType === opt.v 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                    {opt.l}
                </button>
            ))}
        </div>

        {/* Tombol Stake (Unstake All dihapus) */}
        <div className="pt-2">
            <button 
                onClick={handleStake}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-md font-semibold shadow-sm disabled:opacity-50 transition-all"
            >
                {loading ? 'Processing...' : 'Stake Tokens'}
            </button>
        </div>

        {/* Status Message */}
        {status && (
            <div className={`mt-4 text-center text-xs p-2 rounded border ${
                status.toLowerCase().includes("fail") ? "bg-red-50 border-red-200 text-red-600" : "bg-blue-50 border-blue-200 text-blue-600"
            }`}>
                {status}
            </div>
        )}

        {/* --- TABLE: ACTIVE STAKES (Unstake Satuan) --- */}
        <div className="mt-6 pt-4 border-t border-gray-200">
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-3 text-center">Active Positions</h3>
            
            {tranchesList.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-2">No active stakes found.</p>
            ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {tranchesList.map((t: any) => {
                        const isLocked = t.lockUntil > currentTime;

                        return (
                            <div key={t.originalIndex} className="flex justify-between items-center bg-gray-50 p-3 rounded border text-sm shadow-sm">
                                <div>
                                    <p className="font-bold text-gray-800">{Number(formatEther(t.amount)).toLocaleString()} Token</p>
                                    <p className="text-[10px] text-gray-500 uppercase">
                                        Unlock: {formatUnlockDate(t.lockUntil)}
                                    </p>
                                </div>
                                <div>
                                    {isLocked ? (
                                        <div className="bg-gray-200 text-gray-500 text-xs px-3 py-1.5 rounded font-medium flex items-center gap-1">
                                            <span>Locked</span>
                                            <span className="text-[10px]">🔒</span>
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={() => handleUnstakeSingle(t.originalIndex, t.amount)}
                                            disabled={loading}
                                            className="bg-red-100 text-red-600 border border-red-200 hover:bg-red-200 hover:text-red-800 text-xs px-3 py-1.5 rounded font-bold transition-colors disabled:opacity-50"
                                        >
                                            Unstake
                                        </button>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>

      </div>
    </div>
  );
};

export default Staking;
