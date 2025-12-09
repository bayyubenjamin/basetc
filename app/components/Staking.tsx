"use client";

import { useState, useMemo, useEffect } from "react";
import type { FC } from "react";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { base } from "viem/chains";
import { formatEther, parseEther } from "viem";
import { stakingVaultAddress, stakingVaultABI, baseTcAddress, baseTcABI, rigNftABI } from "../lib/web3Config";

const LOCK_OPTIONS = [
  { label: "7 Days (1.0x)", value: 1 },
  { label: "30 Days (1.2x)", value: 2 },
  { label: "365 Days (1.5x)", value: 3 },
];

const MAX_PRO = 5;
const MAX_LEGEND = 3;
const BOOST_CAP = 50; // %

const Staking: FC = () => {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [amount, setAmount] = useState("");
  const [lockType, setLockType] = useState<1 | 2 | 3>(1);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const [position, setPosition] = useState<any>(null);
  const [pendingRewards, setPendingRewards] = useState<bigint>(0n);
  const [baseTcBalance, setBaseTcBalance] = useState<bigint>(0n);
  const [allowance, setAllowance] = useState<bigint>(0n);
  const [nonce, setNonce] = useState<bigint>(0n);

  const [proCount, setProCount] = useState(0);
  const [legendCount, setLegendCount] = useState(0);

  // --- Fetch contract data ---
  const fetchData = async () => {
    if (!address || !publicClient) return;

    try {
      const pos = await publicClient.readContract({
        address: stakingVaultAddress,
        abi: stakingVaultABI,
        functionName: "getUser",
        args: [address],
      });
      setPosition(pos);

      const reward = await publicClient.readContract({
        address: stakingVaultAddress,
        abi: stakingVaultABI,
        functionName: "pendingReward",
        args: [address],
      });
      setPendingRewards(reward as bigint);

      const bal = await publicClient.readContract({
        address: baseTcAddress,
        abi: baseTcABI,
        functionName: "balanceOf",
        args: [address],
      });
      setBaseTcBalance(bal as bigint);

      const allow = await publicClient.readContract({
        address: baseTcAddress,
        abi: baseTcABI,
        functionName: "allowance",
        args: [address, stakingVaultAddress],
      });
      setAllowance(allow as bigint);

      const n = await publicClient.readContract({
        address: stakingVaultAddress,
        abi: stakingVaultABI,
        functionName: "nonces",
        args: [address],
      });
      setNonce(n as bigint);

      // --- Fetch Pro/Legend count from RigNFT ---
      const rigAddr = await publicClient.readContract({
        address: stakingVaultAddress,
        abi: stakingVaultABI,
        functionName: "rigNft",
      });

      const proId = await publicClient.readContract({
        address: stakingVaultAddress,
        abi: stakingVaultABI,
        functionName: "proId",
      });

      const legendId = await publicClient.readContract({
        address: stakingVaultAddress,
        abi: stakingVaultABI,
        functionName: "legendId",
      });

      const proBal = await publicClient.readContract({
        address: rigAddr as `0x${string}`,
        abi: rigNftABI,
        functionName: "balanceOf",
        args: [address, proId],
      });

      const legendBal = await publicClient.readContract({
        address: rigAddr as `0x${string}`,
        abi: rigNftABI,
        functionName: "balanceOf",
        args: [address, legendId],
      });

      setProCount(Number(proBal));
      setLegendCount(Number(legendBal));
    } catch (e: any) {
      console.error("Fetch error", e);
      setStatus("Failed to fetch data.");
    }
  };

  useEffect(() => {
    fetchData();
  }, [address]);

  // --- Derived Data ---
  const stakedAmount = useMemo(() => {
    if (!position || !position.tranches) return 0;
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

  // --- Actions ---
  const handleAction = async (action: "stake" | "unstake") => {
    if (!address) return setStatus("Please connect your wallet.");
    setLoading(true);
    setStatus(`Preparing ${action}...`);

    try {
      const stakeAmount = parseEther(amount || "0");
      if (action === "stake" && stakeAmount <= 0n) throw new Error("Amount must be greater than 0.");
      if (action === "stake" && stakeAmount > baseTcBalance) throw new Error("Insufficient balance.");

      if (action === "stake" && allowance < stakeAmount) {
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
        setStatus("Approval successful. Preparing to stake...");
      }

      const currentNonce = nonce;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

      // --- Sign & Send ---
      let functionName: any;
      let args: any[];

      if (action === "stake") {
        functionName = "stake";
        args = [stakeAmount, lockType];
      } else {
        // unstake automatically claims reward
        functionName = "unstake";
        const trancheIdx = position.tranches.map((_: any, idx: number) => idx);
        const amounts = position.tranches.map((t: any) => t.amount);
        args = [trancheIdx, amounts];
      }

      setStatus("Awaiting transaction confirmation...");
      const txHash = await writeContractAsync({
        address: stakingVaultAddress,
        abi: stakingVaultABI as any,
        functionName,
        args,
        account: address,
        chain: base,
      });

      await publicClient?.waitForTransactionReceipt({ hash: txHash as `0x${string}` });

      setStatus(`${action.charAt(0).toUpperCase() + action.slice(1)} successful!`);
      await fetchData();
    } catch (e: any) {
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

        <div className="grid grid-cols-3 gap-4 text-center mt-2">
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

        <div className="space-y-2 mt-4">
          <label className="text-xs text-gray-500">Amount to Stake</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="space-y-2 mt-2">
          <label className="text-xs text-gray-500">Lock Duration</label>
          <div className="flex gap-2">
            {LOCK_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setLockType(opt.value as 1 | 2 | 3)}
                className={`flex-1 rounded px-2 py-1 text-xs font-medium ${
                  lockType === opt.value ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            onClick={() => handleAction("stake")}
            disabled={loading}
            className="rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? "..." : "Stake"}
          </button>
          <button
            onClick={() => handleAction("unstake")}
            disabled={loading || stakedAmount <= 0}
            className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? "..." : "Unstake + Claim"}
          </button>
        </div>

        {status && <p className="text-center text-xs text-gray-500 pt-2">{status}</p>}
      </div>
    </div>
  );
};

export default Staking;