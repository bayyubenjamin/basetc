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

  // Time State
  const [currentTime, setCurrentTime] = useState(Math.floor(Date.now() / 1000));

  // --- 1. FETCH DATA ---
  const fetchData = async () => {
    if (!address || !publicClient) return;

    try {
      const results = await publicClient.multicall({
        contracts: [
          { address: stakingVaultAddress, abi: stakingVaultABI as any, functionName: 'getUser', args: [address] },
          { address: stakingVaultAddress, abi: stakingVaultABI as any, functionName: 'pendingReward', args: [address] },
          { address: baseTcAddress, abi: baseTcABI as any, functionName: 'balanceOf', args: [address] },
          { address: baseTcAddress, abi: baseTcABI as any, functionName: 'allowance', args: [address, stakingVaultAddress] },
          { address: stakingVaultAddress, abi: stakingVaultABI as any, functionName: 'rigNFT', args: [] },
          { address: stakingVaultAddress, abi: stakingVaultABI as any, functionName: 'proId', args: [] },
          { address: stakingVaultAddress, abi: stakingVaultABI as any, functionName: 'legendId', args: [] },
        ],
        allowFailure: true 
      });

      if (results[0].status === 'success') setPositionRaw(results[0].result);
      if (results[1].status === 'success') setRewardsRaw(BigInt(results[1].result as any || 0));
      if (results[2].status === 'success') setBalanceRaw(BigInt(results[2].result as any || 0));
      if (results[3].status === 'success') setAllowanceRaw(BigInt(results[3].result as any || 0));

      const rigAddr = results[4].status === 'success' ? results[4].result as string : null;
      const proId = results[5].status === 'success' ? results[5].result : null;
      const legendId = results[6].status === 'success' ? results[6].result : null;

      if (rigAddr && rigAddr !== "0x0000000000000000000000000000000000000000") {
          fetchNftData(rigAddr, proId, legendId);
      }
    } catch (e) { console.error("Fetch Error:", e); }
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
        });
        if(nftRes[0].status === 'success') setProCount(Number(nftRes[0].result));
        if(nftRes[1].status === 'success') setLegendCount(Number(nftRes[1].result));
      } catch (err) { console.warn("NFT Fail", err); }
  }

  useEffect(() => {
    fetchData();
    const intervalData = setInterval(fetchData, 15000);
    const intervalTime = setInterval(() => setCurrentTime(Math.floor(Date.now() / 1000)), 60000);
    return () => { clearInterval(intervalData); clearInterval(intervalTime); };
  }, [address]);

  // --- 2. CALCULATIONS ---
  
  const getTranches = useMemo(() => {
    if (!positionRaw) return [];
    let tranches: any[] = [];
    if (Array.isArray(positionRaw)) {
        if (Array.isArray(positionRaw[0])) tranches = positionRaw[0];
        else tranches = positionRaw;
    } else if (positionRaw?.tranches) {
        tranches = positionRaw.tranches;
    }
    // Filter out empty tranches (amount 0)
    return Array.isArray(tranches) 
        ? tranches.filter((t:any) => {
            const amt = t?.amount !== undefined ? BigInt(t.amount) : (Array.isArray(t) ? BigInt(t[0]) : 0n);
            return amt > 0n;
        })
        : [];
  }, [positionRaw]);

  const stakedAmount = useMemo(() => {
    try {
        const total = getTranches.reduce((sum: bigint, t: any) => {
            const val = t?.amount !== undefined ? BigInt(t.amount) : (Array.isArray(t) ? BigInt(t[0]) : 0n);
            return sum + val;
        }, 0n);
        return formatEther(total);
    } catch (e) { return "0"; }
  }, [getTranches]);

  const rewardsDisplay = useMemo(() => rewardsRaw ? formatEther(rewardsRaw) : "0", [rewardsRaw]);

  const boostPercent = useMemo(() => {
    const pro = Math.min(proCount, MAX_PRO);
    const legend = Math.min(legendCount, MAX_LEGEND);
    return Math.min((pro * 5) + (legend * 8), BOOST_CAP);
  }, [proCount, legendCount]);

  // Format Date Helper
  const formatUnlockDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString("id-ID", { 
        day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute:"2-digit" 
    });
  };

  // --- 3. ACTIONS ---
  const handleAction = async (isStake: boolean) => {
    if (!address) return;
    setLoading(true);
    setStatus("Processing...");

    try {
        if (isStake) {
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

        } else {
            // UNSTAKE PINTAR (Hanya yang sudah unlock)
            setStatus("Checking locks...");
            const now = Math.floor(Date.now() / 1000);
            
            // Perlu index asli dari Raw Data (bukan filtered) untuk contract call
            // Kita fetch ulang sebentar raw tranches full list
            let fullTranches: any[] = [];
            if (Array.isArray(positionRaw)) {
                 fullTranches = Array.isArray(positionRaw[0]) ? positionRaw[0] : positionRaw;
            } else if (positionRaw?.tranches) {
                 fullTranches = positionRaw.tranches;
            }

            const readyToUnstake = fullTranches.map((t: any, i: number) => {
                 const val = t?.amount !== undefined ? BigInt(t.amount) : (Array.isArray(t) ? BigInt(t[0]) : 0n);
                 const lockTime = t?.lockUntil !== undefined ? Number(t.lockUntil) : (Array.isArray(t) ? Number(t[1]) : 0);
                 return { idx: i, val, lockTime };
            }).filter(x => x.val > 0n && x.lockTime <= now);

            if (readyToUnstake.length === 0) {
                 // Cek apakah ada yg locked
                 const anyLocked = fullTranches.some((t:any) => {
                    const v = t?.amount !== undefined ? BigInt(t.amount) : (Array.isArray(t) ? BigInt(t[0]) : 0n);
                    return v > 0n;
                 });
                 if (anyLocked) throw new Error("Stakes are still locked.");
                 else throw new Error("No active stakes.");
            }

            setStatus(`Unstaking ${readyToUnstake.length} ready items...`);
            const tx = await writeContractAsync({
                address: stakingVaultAddress,
                abi: stakingVaultABI as any,
                functionName: 'unstake',
                args: [readyToUnstake.map(x => x.idx), readyToUnstake.map(x => x.val)],
                chain: base
            } as any);
            await publicClient?.waitForTransactionReceipt({ hash: tx });
        }

        setStatus("Success!");
        if (isStake) setAmount("");
        fetchData(); 
        setTimeout(fetchData, 4000); 

    } catch (e: any) {
        setStatus("Failed: " + (e.shortMessage || e.message));
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
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500 mb-1">Pending Rewards</p>
            <p className="text-xl font-bold text-green-600 truncate">
                {Number(rewardsDisplay).toFixed(6)}
            </p>
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

        {/* Inputs */}
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

        <div className="flex gap-2">
            {[
                { l: "30D", v: 0 }, { l: "90D", v: 1 }, { l: "365D", v: 2 }
            ].map((opt: any) => (
                <button 
                    key={opt.v}
                    onClick={() => setLockType(opt.v)}
                    disabled={loading}
                    className={`flex-1 py-2 text-xs font-semibold rounded transition-colors ${
                        lockType === opt.v ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                >
                    {opt.l}
                </button>
            ))}
        </div>

        {/* Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
            <button 
                onClick={() => handleAction(true)}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 text-white py-3 rounded-md font-semibold shadow-sm disabled:opacity-50 transition-all"
            >
                {loading ? 'Processing...' : 'Stake'}
            </button>
            <button 
                onClick={() => handleAction(false)}
                disabled={loading}
                className="bg-red-500 hover:bg-red-600 text-white py-3 rounded-md font-semibold shadow-sm disabled:opacity-50 transition-all"
            >
                {loading ? '...' : 'Unstake Ready'}
            </button>
        </div>

        {status && (
            <div className={`mt-4 text-center text-xs p-2 rounded border ${
                status.includes("Fail") ? "bg-red-50 border-red-200 text-red-600" : "bg-blue-50 border-blue-200 text-blue-600"
            }`}>
                {status}
            </div>
        )}

        {/* --- TABEL DAFTAR STAKING (FITUR BARU) --- */}
        <div className="mt-6 pt-4 border-t border-gray-200">
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Active Stakes</h3>
            
            {getTranches.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-2">No active stakes found.</p>
            ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {getTranches.map((t: any, idx: number) => {
                        const val = t?.amount !== undefined ? BigInt(t.amount) : (Array.isArray(t) ? BigInt(t[0]) : 0n);
                        const lockTime = t?.lockUntil !== undefined ? Number(t.lockUntil) : (Array.isArray(t) ? Number(t[1]) : 0);
                        const isLocked = lockTime > currentTime;

                        return (
                            <div key={idx} className="flex justify-between items-center bg-gray-50 p-2 rounded border text-sm">
                                <div>
                                    <p className="font-bold text-gray-800">{Number(formatEther(val)).toLocaleString()} Token</p>
                                    <p className="text-xs text-gray-500">Unlock: {formatUnlockDate(lockTime)}</p>
                                </div>
                                <div>
                                    {isLocked ? (
                                        <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-1 rounded font-semibold border border-yellow-200">
                                            🔒 Locked
                                        </span>
                                    ) : (
                                        <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded font-semibold border border-green-200">
                                            ✅ Ready
                                        </span>
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
