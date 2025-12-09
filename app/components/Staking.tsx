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

// --- KONSTANTA & CONFIG ---
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const LOCK_OPTIONS = [
  { label: "30 Days (1.0x)", value: 0 },
  { label: "90 Days (1.2x)", value: 1 },
  { label: "365 Days (1.5x)", value: 2 },
];

const MAX_PRO = 5;
const MAX_LEGEND = 3;
const BOOST_CAP = 50; // %

const Staking: FC = () => {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  // Inputs
  const [amount, setAmount] = useState("");
  const [lockType, setLockType] = useState<0 | 1 | 2>(0);
  
  // Status UI
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  // Blockchain Data
  const [position, setPosition] = useState<any>(null); // Raw data dari contract
  const [pendingRewards, setPendingRewards] = useState<bigint>(0n);
  const [baseTcBalance, setBaseTcBalance] = useState<bigint>(0n);
  const [allowance, setAllowance] = useState<bigint>(0n);
  const [proCount, setProCount] = useState(0);
  const [legendCount, setLegendCount] = useState(0);

  // --- 1. FETCH DATA (ROBUST VERSION) ---
  const fetchData = async () => {
    if (!address || !publicClient) return;

    try {
      setStatus(prev => prev === "Loading data..." ? prev : ""); // Jangan hapus status error jika ada

      // A. Fetch Data Utama (Batching)
      const [
        userRes,
        pendingRes,
        balanceRes,
        allowanceRes,
        rigAddrRes,
        proIdRes,
        legendIdRes
      ] = await publicClient.multicall({
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
        allowFailure: false 
      } as any) as any;

      // Debugging: Lihat struktur data di Console Browser (F12)
      console.log("DEBUG: Raw Position Data:", userRes);

      // Set State Dasar
      setPosition(userRes);
      setPendingRewards(BigInt(pendingRes));
      setBaseTcBalance(BigInt(balanceRes));
      setAllowance(BigInt(allowanceRes));

      // B. Fetch NFT Data (Hanya jika address valid)
      const rigAddr = rigAddrRes as `0x${string}`;
      const proId = BigInt(proIdRes);
      const legendId = BigInt(legendIdRes);

      if (rigAddr && rigAddr !== ZERO_ADDRESS) {
        try {
          const [proBalRes, legendBalRes] = await publicClient.multicall({
            contracts: [
              { address: rigAddr, abi: rigNftABI as any, functionName: 'balanceOf', args: [address, proId] },
              { address: rigAddr, abi: rigNftABI as any, functionName: 'balanceOf', args: [address, legendId] },
            ],
            allowFailure: true 
          } as any);

          setProCount(proBalRes.status === 'success' ? Number(proBalRes.result) : 0);
          setLegendCount(legendBalRes.status === 'success' ? Number(legendBalRes.result) : 0);
        } catch (err) {
          console.warn("NFT fetch warning:", err);
        }
      }
    } catch (e: any) {
      console.error("Fetch error", e);
      // Jangan timpa status sukses transaksi dengan error fetch kecil
      if (!status.includes("successful")) {
         setStatus("Network sync issue. Retrying...");
      }
    }
  };

  useEffect(() => {
    fetchData();
    // Optional: Auto refresh setiap 30 detik
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [address]);

  // --- 2. DATA CALCULATION (SMART PARSING FIX) ---
  const stakedAmount = useMemo(() => {
    if (!position) return 0;

    let tranchesList: any[] = [];

    // LOGIKA PARSING PENTING:
    // Contract sering mengembalikan array tuple (misal: [tranchesArray, otherData])
    // atau object jika ABI sangat spesifik. Kode ini menangani keduanya.
    
    if (Array.isArray(position)) {
      // Jika position adalah array, biasanya elemen pertama adalah array of tranches
      if (Array.isArray(position[0])) {
        tranchesList = position[0];
      } else {
        // Fallback: anggap position itu sendiri list tranches
        tranchesList = position;
      }
    } else if (typeof position === 'object' && position.tranches) {
      // Jika position adalah object murni
      tranchesList = position.tranches;
    }

    if (!Array.isArray(tranchesList)) return 0;

    return tranchesList.reduce((sum: number, t: any) => {
      // Handle jika 't' (tranche item) berupa Array [amount, lockStart...] atau Object {amount: ...}
      const rawAmount = (t && t.amount !== undefined) ? t.amount : (Array.isArray(t) ? t[0] : 0n);
      
      return sum + Number(formatEther(BigInt(rawAmount || 0)));
    }, 0);
  }, [position]);

  const rewards = useMemo(() => {
    return pendingRewards ? Number(formatEther(pendingRewards)) : 0;
  }, [pendingRewards]);

  const boostPercent = useMemo(() => {
    const pro = Math.min(proCount, MAX_PRO);
    const legend = Math.min(legendCount, MAX_LEGEND);
    return Math.min((pro * 5) + (legend * 8), BOOST_CAP);
  }, [proCount, legendCount]);

  const boostedRewards = useMemo(() => rewards * (1 + boostPercent / 100), [rewards, boostPercent]);

  // --- 3. ACTIONS ---
  const handleAction = async (action: "stake" | "unstake") => {
    if (!address) return setStatus("Please connect your wallet.");
    setLoading(true);
    setStatus(`Preparing to ${action}...`);

    try {
      const stakeAmount = parseEther(amount || "0");

      // VALIDASI & APPROVE
      if (action === "stake") {
        if (stakeAmount <= 0n) throw new Error("Amount must be greater than 0.");
        if (stakeAmount > baseTcBalance) throw new Error(`Insufficient Balance. You have ${formatEther(baseTcBalance)}.`);

        if (allowance < stakeAmount) {
          setStatus("Approving $BaseTC...");
          const approveHash = await writeContractAsync({
            address: baseTcAddress,
            abi: baseTcABI as any,
            functionName: "approve",
            args: [stakingVaultAddress, stakeAmount],
            chain: base,
          } as any);
          await publicClient?.waitForTransactionReceipt({ hash: approveHash });
          setStatus("Approval successful. Processing stake...");
          setAllowance(stakeAmount);
        }
      }

      // PREPARE ARGS
      let functionName = action === "stake" ? "stake" : "unstake";
      let args: any[] = [];

      if (action === "stake") {
        args = [stakeAmount, lockType];
      } else {
        // Unstake logic: find active tranches
        // Kita gunakan logika parsing yang sama dengan useMemo stakedAmount
        let tranchesList: any[] = [];
        if (Array.isArray(position)) {
           tranchesList = Array.isArray(position[0]) ? position[0] : position;
        } else if (position?.tranches) {
           tranchesList = position.tranches;
        }

        if (!tranchesList || tranchesList.length === 0) throw new Error("No active stakes.");
        
        // Map tranches to indices and amounts
        const activeItems = tranchesList
            .map((t: any, idx: number) => {
                const amt = (t && t.amount !== undefined) ? t.amount : (Array.isArray(t) ? t[0] : 0n);
                return { idx, amount: BigInt(amt || 0) };
            })
            .filter((item) => item.amount > 0n);

        if (activeItems.length === 0) throw new Error("No active stakes to unstake.");

        const trancheIdx = activeItems.map((i) => i.idx);
        const amounts = activeItems.map((i) => i.amount);
        args = [trancheIdx, amounts];
      }

      // EXECUTE TX
      setStatus("Confirm transaction in wallet...");
      const txHash = await writeContractAsync({
        address: stakingVaultAddress,
        abi: stakingVaultABI as any,
        functionName,
        args,
        chain: base,
      } as any);

      setStatus("Transaction sent. Waiting confirmation...");
      await publicClient?.waitForTransactionReceipt({ hash: txHash });

      setStatus(`${action === 'stake' ? 'Staking' : 'Unstaking'} successful!`);
      if (action === "stake") setAmount("");

      // --- DOUBLE REFRESH STRATEGY ---
      // Refresh 1: Immediate
      fetchData();
      // Refresh 2: Delayed (menunggu node indexing)
      setTimeout(() => {
        console.log("Triggering delayed refresh...");
        fetchData();
      }, 5000);

    } catch (e: any) {
      console.error(e);
      setStatus(e?.shortMessage || e?.message || "Transaction failed.");
    } finally {
      setLoading(false);
    }
  };

  // --- UI RENDER ---
  return (
    <div className="max-w-md mx-auto p-4">
      <div className="space-y-6 rounded-lg bg-white p-6 border border-gray-300 shadow-md relative">
        
        {/* Header & Refresh Button */}
        <div className="flex justify-between items-center relative">
            <h2 className="text-lg font-bold text-gray-800 w-full text-center">Staking Dashboard</h2>
            <button 
                onClick={fetchData} 
                className="absolute right-0 text-xs text-blue-500 hover:text-blue-700 underline"
                title="Refresh Data"
            >
                Refresh
            </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-sm text-gray-500">Staked Amount</p>
            <p className="text-xl font-bold text-gray-900">{stakedAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Pending Rewards</p>
            <p className="text-xl font-bold text-green-600">{rewards.toFixed(6)}</p>
            <p className="text-xs text-gray-400">Boosted: {boostedRewards.toFixed(6)}</p>
          </div>
        </div>

        {/* NFT Boost Info */}
        <div className="grid grid-cols-3 gap-4 text-center mt-2 border-t pt-4">
          <div>
            <p className="text-sm text-gray-500">Pro NFT</p>
            <p className="text-lg font-bold text-gray-900">{proCount}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Legend NFT</p>
            <p className="text-lg font-bold text-gray-900">{legendCount}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Boost</p>
            <p className="text-lg font-bold text-green-600">{boostPercent}%</p>
          </div>
        </div>

        {/* Form Input */}
        <div className="space-y-2 mt-4">
          <div className="flex justify-between">
            <label className="text-xs text-gray-500">Amount to Stake</label>
            <span className="text-xs text-gray-400">
                Bal: {baseTcBalance ? Number(formatEther(baseTcBalance)).toFixed(4) : "0"}
            </span>
          </div>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            disabled={loading}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
        </div>

        {/* Lock Duration */}
        <div className="space-y-2 mt-2">
          <label className="text-xs text-gray-500">Lock Duration</label>
          <div className="flex gap-2">
            {LOCK_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setLockType(opt.value as 0 | 1 | 2)} 
                disabled={loading}
                className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                  lockType === opt.value ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            onClick={() => handleAction("stake")}
            disabled={loading}
            className="rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-green-700 transition-colors"
          >
            {loading ? "Processing..." : "Stake"}
          </button>
          <button
            onClick={() => handleAction("unstake")}
            disabled={loading || stakedAmount <= 0}
            className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-red-700 transition-colors"
          >
            {loading ? "Processing..." : "Unstake All"}
          </button>
        </div>

        {/* Status Message */}
        {status && (
            <div className={`mt-4 text-center text-xs p-2 rounded border break-words ${
                status.toLowerCase().includes("fail") || status.toLowerCase().includes("error") 
                ? "bg-red-50 text-red-600 border-red-200" 
                : "bg-blue-50 text-blue-600 border-blue-200"
            }`}>
                {status}
            </div>
        )}
      </div>
    </div>
  );
};

export default Staking;
