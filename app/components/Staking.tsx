"use client";

import { useState, useMemo, useEffect, type FC } from "react";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { base } from "viem/chains";
import { formatEther, parseEther } from "viem";
import { 
  stakingVaultAddress, 
  stakingVaultABI, // PASTIKAN FILE INI SUDAH DIUPDATE DENGAN ABI BARU
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

  // --- 1. FETCH DATA ---
  const fetchData = async () => {
    if (!address || !publicClient) return;

    try {
      // Multicall request
      const results = await publicClient.multicall({
        contracts: [
          // 0. User Position -> [baseWeight, effectiveWeight, lastAction, unclaimed, tranches]
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

      // DEBUG: Cek hasil getUser di console untuk memastikan urutan index
      if (resArray[0].status === 'success') {
          // console.log("DEBUG Position:", resArray[0].result);
          setPositionRaw(resArray[0].result);
      }
      
      if (resArray[1].status === 'success') setRewardsRaw(BigInt(resArray[1].result || 0));
      if (resArray[2].status === 'success') setBalanceRaw(BigInt(resArray[2].result || 0));
      if (resArray[3].status === 'success') setAllowanceRaw(BigInt(resArray[3].result || 0));

      // Parsing NFT Data
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
    const interval = setInterval(fetchData, 10000); // Auto refresh tiap 10 detik
    return () => clearInterval(interval);
  }, [address]);

  // --- 2. CALCULATIONS (SAFE PARSING) ---
  const stakedAmount = useMemo(() => {
    if (!positionRaw) return "0";

    try {
        // ABI Baru: getUser returns struct dengan urutan:
        // 0: baseWeight, 1: effectiveWeight, 2: lastActionAt, 3: unclaimed, 4: tranches
        
        // Cek apakah positionRaw adalah array (Tuple)
        if (!Array.isArray(positionRaw)) return "0";

        // Ambil data tranches di index ke-4
        const tranchesData = positionRaw[4];

        if (!Array.isArray(tranchesData)) return "0";

        const total = tranchesData.reduce((sum: bigint, t: any) => {
            if (!t) return sum;
            
            // Handle jika Viem return Object atau Array
            let val = 0n;
            if (t.amount !== undefined) {
                val = BigInt(t.amount);
            } else if (Array.isArray(t) && t[0] !== undefined) {
                val = BigInt(t[0]);
            }
            
            return sum + val;
        }, 0n);

        return formatEther(total);

    } catch (e) {
        console.error("Calc Error:", e);
        return "0";
    }
  }, [positionRaw]);

  const rewardsDisplay = useMemo(() => {
     return rewardsRaw ? formatEther(rewardsRaw) : "0";
  }, [rewardsRaw]);

  const boostPercent = useMemo(() => {
    const pro = Math.min(proCount, MAX_PRO);
    const legend = Math.min(legendCount, MAX_LEGEND);
    return Math.min((pro * 5) + (legend * 8), BOOST_CAP);
  }, [proCount, legendCount]);

  // --- 3. ACTIONS ---
  
  // Fungsi khusus untuk CLAIM (Panen Reward)
  const handleClaim = async () => {
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

  const handleAction = async (isStake: boolean) => {
    if (!address) return;
    setLoading(true);
    setStatus("Processing...");

    try {
        if (isStake) {
            const val = parseEther(amount || "0");
            if (val <= 0n) throw new Error("Amount > 0");
            
            // Check Allowance
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
                args: [val, lockType], // Sesuai ABI: stake(uint256, uint8)
                chain: base
            } as any);
            await publicClient?.waitForTransactionReceipt({ hash: tx });

        } else {
            setStatus("Unstaking...");
            
            // Validasi data sebelum unstake
            if (!Array.isArray(positionRaw) || !Array.isArray(positionRaw[4])) {
                 throw new Error("No staking data found");
            }
            
            const tranchesData = positionRaw[4];

            // Cari tranche yang aktif (>0)
            const activeData = tranchesData.map((t: any, i: number) => {
                 const val = t?.amount !== undefined ? BigInt(t.amount) : (Array.isArray(t) ? BigInt(t[0]) : 0n);
                 return { idx: i, val };
            }).filter(x => x.val > 0n);

            if (activeData.length === 0) throw new Error("No active stakes");

            const tx = await writeContractAsync({
                address: stakingVaultAddress,
                abi: stakingVaultABI as any,
                functionName: 'unstake',
                args: [activeData.map(x => x.idx), activeData.map(x => x.val)], // Sesuai ABI: unstake(uint256[], uint256[])
                chain: base
            } as any);
            await publicClient?.waitForTransactionReceipt({ hash: tx });
        }

        setStatus("Success!");
        if (isStake) setAmount("");
        fetchData(); 
        setTimeout(fetchData, 4000); // Delay refresh untuk indexing

    } catch (e: any) {
        setStatus("Failed: " + (e.shortMessage || e.message));
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4">
      <div className="space-y-6 rounded-lg bg-white p-6 border border-gray-300 shadow-md relative">
        
        {/* Header & Refresh */}
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
            {/* NEW: Claim Button (Muncul jika ada reward > 0) */}
            {rewardsRaw > 0n && (
                <button 
                    onClick={handleClaim}
                    disabled={loading}
                    className="mt-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200 w-full"
                >
                    {loading ? "..." : "Claim Rewards"}
                </button>
            )}
          </div>
        </div>

        {/* NFT Boost UI */}
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

        {/* Form */}
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

        {/* Locks */}
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
                {loading ? '...' : 'Unstake All'}
            </button>
        </div>

        {/* Status */}
        {status && (
            <div className={`mt-4 text-center text-xs p-2 rounded border ${
                status.includes("Fail") ? "bg-red-50 border-red-200 text-red-600" : "bg-blue-50 border-blue-200 text-blue-600"
            }`}>
                {status}
            </div>
        )}
      </div>
    </div>
  );
};

export default Staking;
