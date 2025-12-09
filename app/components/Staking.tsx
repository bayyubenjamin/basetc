"use client";

import { useState, useMemo, useEffect, type FC } from "react";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { base } from "viem/chains";
import { formatEther, parseEther } from "viem";
import { stakingVaultAddress, stakingVaultABI, baseTcAddress, baseTcABI, rigNftABI } from "../lib/web3Config";

// Konstanta Safety Check
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

  const [amount, setAmount] = useState("");
  const [lockType, setLockType] = useState<0 | 1 | 2>(0);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  // State Data
  const [position, setPosition] = useState<any>(null);
  const [pendingRewards, setPendingRewards] = useState<bigint>(0n);
  const [baseTcBalance, setBaseTcBalance] = useState<bigint>(0n);
  const [allowance, setAllowance] = useState<bigint>(0n);

  const [proCount, setProCount] = useState(0);
  const [legendCount, setLegendCount] = useState(0);

  // --- 1. FETCH DATA (OPTIMIZED WITH MULTICALL) ---
  const fetchData = async () => {
    if (!address || !publicClient) return;

    try {
      // PHASE 1: Ambil Data Utama dalam SATU Request (Batching)
      // Ini mencegah error "HTTP Request Failed" karena rate limit RPC
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
        allowFailure: false // Jika satu gagal, lempar error agar kita tahu
      });

      // Update State Utama
      setPosition(userRes);
      setPendingRewards(BigInt(pendingRes as bigint));
      setBaseTcBalance(BigInt(balanceRes as bigint));
      setAllowance(BigInt(allowanceRes as bigint));

      // PHASE 2: Fetch Data NFT (Hanya jika address valid)
      const rigAddr = rigAddrRes as `0x${string}`;
      const proId = BigInt(proIdRes as bigint);
      const legendId = BigInt(legendIdRes as bigint);

      if (rigAddr && rigAddr !== ZERO_ADDRESS) {
        try {
          // Batching request saldo NFT juga
          const [proBalRes, legendBalRes] = await publicClient.multicall({
            contracts: [
              { address: rigAddr, abi: rigNftABI as any, functionName: 'balanceOf', args: [address, proId] },
              { address: rigAddr, abi: rigNftABI as any, functionName: 'balanceOf', args: [address, legendId] },
            ],
            allowFailure: true // Boleh gagal jika kontrak NFT bermasalah
          });

          if (proBalRes.status === 'success') setProCount(Number(proBalRes.result));
          else setProCount(0);

          if (legendBalRes.status === 'success') setLegendCount(Number(legendBalRes.result));
          else setLegendCount(0);

        } catch (err) {
          console.warn("NFT fetch warning:", err);
          setProCount(0);
          setLegendCount(0);
        }
      } else {
        setProCount(0);
        setLegendCount(0);
      }

      setStatus(""); // Clear error status
    } catch (e: any) {
      console.error("Fetch error", e);
      // Deteksi error spesifik
      if (e?.message?.includes("HTTP")) {
         setStatus("Network busy. Please refresh shortly.");
      } else {
         setStatus("Fetch failed: " + (e?.shortMessage || e?.message));
      }
    }
  };

  // Auto-refresh saat address berubah
  useEffect(() => {
    fetchData();
  }, [address]);

  // --- 2. DATA DERIVATIVES ---
  const stakedAmount = useMemo(() => {
    if (!position || !position.tranches) return 0;
    // position.tranches adalah array struct dari contract
    return position.tranches.reduce((sum: number, t: any) => sum + Number(formatEther(t.amount)), 0);
  }, [position]);

  const rewards = useMemo(() => {
    if (!pendingRewards) return 0;
    return Number(formatEther(pendingRewards));
  }, [pendingRewards]);

  const boostPercent = useMemo(() => {
    const pro = Math.min(proCount, MAX_PRO);
    const legend = Math.min(legendCount, MAX_LEGEND);
    const total = pro * 5 + legend * 8;
    return Math.min(total, BOOST_CAP);
  }, [proCount, legendCount]);

  const boostedRewards = useMemo(() => rewards * (1 + boostPercent / 100), [rewards, boostPercent]);

  // --- 3. ACTIONS ---
  const handleAction = async (action: "stake" | "unstake") => {
    if (!address) return setStatus("Please connect your wallet.");
    setLoading(true);
    setStatus(`Preparing to ${action}...`);

    try {
      const stakeAmount = parseEther(amount || "0");

      // --- LOGIC STAKE ---
      if (action === "stake") {
        if (stakeAmount <= 0n) throw new Error("Amount must be greater than 0.");
        
        // Pengecekan saldo yang lebih ramah
        if (baseTcBalance === 0n) {
             throw new Error("Saldo BaseTC kosong atau gagal dimuat. Coba refresh.");
        }
        if (stakeAmount > baseTcBalance) {
             throw new Error(`Insufficient balance. Anda punya ${formatEther(baseTcBalance)} BaseTC.`);
        }

        if (allowance < stakeAmount) {
          setStatus("Approving $BaseTC...");
          const approveHash = await writeContractAsync({
            address: baseTcAddress,
            abi: baseTcABI as any,
            functionName: "approve",
            args: [stakingVaultAddress, stakeAmount],
            account: address,
            chain: base,
          });
          await publicClient?.waitForTransactionReceipt({ hash: approveHash as `0x${string}` });
          setStatus("Approval successful. Processing stake...");
          setAllowance(stakeAmount);
        }
      }

      // --- LOGIC UNSTAKE ---
      let functionName: string;
      let args: any[];

      if (action === "stake") {
        functionName = "stake";
        args = [stakeAmount, lockType];
      } else {
        functionName = "unstake";
        if (!position || !position.tranches) throw new Error("No staking position loaded.");
        
        const activeTranches = position.tranches
            .map((t: any, idx: number) => ({ idx, amount: t.amount }))
            .filter((item: any) => item.amount > 0n);

        if (activeTranches.length === 0) throw new Error("No active stakes to unstake.");

        const trancheIdx = activeTranches.map((item: any) => item.idx);
        const amounts = activeTranches.map((item: any) => item.amount);
        args = [trancheIdx, amounts];
      }

      // --- EXECUTE TRANSACTION ---
      setStatus("Please confirm transaction in your wallet...");
      const txHash = await writeContractAsync({
        address: stakingVaultAddress,
        abi: stakingVaultABI as any,
        functionName,
        args,
        account: address,
        chain: base,
      });

      setStatus("Transaction sent. Waiting confirmation...");
      await publicClient?.waitForTransactionReceipt({ hash: txHash as `0x${string}` });

      setStatus(`${action === 'stake' ? 'Staking' : 'Unstaking'} successful!`);
      if (action === "stake") setAmount(""); 
      
      // Delay sedikit sebelum fetch ulang agar blockchain terupdate
      setTimeout(() => fetchData(), 2000);

    } catch (e: any) {
      console.error(e);
      setStatus(e?.shortMessage || e?.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  // --- UI ---
  return (
    <div className="max-w-md mx-auto p-4">
      <div className="space-y-6 rounded-lg bg-white p-6 border border-gray-300 shadow-md">
        <h2 className="text-lg font-bold text-gray-800 text-center">Staking Dashboard</h2>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-sm text-gray-500">Staked Amount</p>
            <p className="text-xl font-bold text-gray-900">{stakedAmount.toLocaleString()}</p>
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
            {/* Helper Balance Display */}
            <span className="text-xs text-gray-400">
                Bal: {baseTcBalance ? formatEther(baseTcBalance) : "0"}
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

        {/* Buttons */}
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
