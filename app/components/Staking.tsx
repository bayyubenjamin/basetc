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

  const [position, setPosition] = useState<any>(null);
  const [pendingRewards, setPendingRewards] = useState<bigint>(0n);
  const [baseTcBalance, setBaseTcBalance] = useState<bigint>(0n);
  const [allowance, setAllowance] = useState<bigint>(0n);

  const [proCount, setProCount] = useState(0);
  const [legendCount, setLegendCount] = useState(0);

  // --- 1. FETCH DATA ---
  const fetchData = async () => {
    if (!address || !publicClient) return;

    try {
      // Ambil data User Position
      const pos = await publicClient.readContract({
        address: stakingVaultAddress,
        abi: stakingVaultABI,
        functionName: "getUser",
        args: [address],
        authorizationList: [], // Ditambahkan kembali untuk fix build error
      });
      setPosition(pos);

      // Ambil Pending Rewards
      const rewardRaw = await publicClient.readContract({
        address: stakingVaultAddress,
        abi: stakingVaultABI,
        functionName: "pendingReward",
        args: [address],
        authorizationList: [], 
      });
      setPendingRewards(BigInt(rewardRaw as bigint | number | string));

      // Ambil Saldo BaseTC User
      const balRaw = await publicClient.readContract({
        address: baseTcAddress,
        abi: baseTcABI,
        functionName: "balanceOf",
        args: [address],
        authorizationList: [],
      });
      setBaseTcBalance(BigInt(balRaw as bigint | number | string));

      // Ambil Allowance
      const allowRaw = await publicClient.readContract({
        address: baseTcAddress,
        abi: baseTcABI,
        functionName: "allowance",
        args: [address, stakingVaultAddress],
        authorizationList: [],
      });
      setAllowance(BigInt(allowRaw as bigint | number | string));

      // --- BAGIAN KRUSIAL: FETCH NFT ---
      // Kita ambil address RigNFT dari kontrak StakingVault
      const rigAddr = (await publicClient.readContract({
        address: stakingVaultAddress,
        abi: stakingVaultABI,
        functionName: "rigNft",
        authorizationList: [],
      })) as `0x${string}`;

      const proIdRaw = await publicClient.readContract({
        address: stakingVaultAddress,
        abi: stakingVaultABI,
        functionName: "proId",
        authorizationList: [],
      });
      const proId = BigInt(proIdRaw as bigint | number | string);

      const legendIdRaw = await publicClient.readContract({
        address: stakingVaultAddress,
        abi: stakingVaultABI,
        functionName: "legendId",
        authorizationList: [],
      });
      const legendId = BigInt(legendIdRaw as bigint | number | string);

      // FIX: Cek apakah rigAddr valid (bukan 0x0) sebelum memanggil balanceOf
      // Ini mencegah crash jika kontrak belum sempurna terhubung atau ada delay RPC
      if (rigAddr && rigAddr !== ZERO_ADDRESS) {
        try {
          const proBalRaw = await publicClient.readContract({
            address: rigAddr,
            abi: rigNftABI,
            functionName: "balanceOf",
            args: [address, proId],
            authorizationList: [],
          });
          setProCount(Number(proBalRaw));

          const legendBalRaw = await publicClient.readContract({
            address: rigAddr,
            abi: rigNftABI,
            functionName: "balanceOf",
            args: [address, legendId],
            authorizationList: [],
          });
          setLegendCount(Number(legendBalRaw));
        } catch (err) {
          console.warn("Gagal membaca NFT balance (abaikan jika tidak punya NFT):", err);
          setProCount(0);
          setLegendCount(0);
        }
      } else {
        // Jika rigNft belum diset, anggap 0
        setProCount(0);
        setLegendCount(0);
      }

      setStatus(""); // Clear status error jika berhasil
    } catch (e: any) {
      console.error("Fetch error", e);
      setStatus("failed: " + (e?.shortMessage || e?.message));
    }
  };

  useEffect(() => {
    fetchData();
  }, [address]);

  // --- 2. PERHITUNGAN DATA ---
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

  // --- 3. ACTIONS (STAKE & UNSTAKE) ---
  const handleAction = async (action: "stake" | "unstake") => {
    if (!address) return setStatus("Please connect your wallet.");
    setLoading(true);
    setStatus(`Preparing to ${action}...`);

    try {
      const stakeAmount = parseEther(amount || "0");

      // Validasi STAKE
      if (action === "stake") {
        if (stakeAmount <= 0n) throw new Error("Amount must be greater than 0.");
        if (stakeAmount > baseTcBalance) throw new Error("Insufficient balance.");

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
          // Update allowance lokal sementara
          setAllowance(stakeAmount);
        }
      }

      // Persiapan Transaksi
      let functionName: string;
      let args: any[];

      if (action === "stake") {
        functionName = "stake";
        args = [stakeAmount, lockType];
      } else {
        // --- FIX KRUSIAL UNTUK UNSTAKE ---
        functionName = "unstake";

        if (!position || !position.tranches) throw new Error("No staking position.");
        
        // 1. Ambil semua tranche, simpan index aslinya
        // 2. Filter HANYA tranche yang jumlahnya > 0
        const activeTranches = position.tranches
            .map((t: any, idx: number) => ({ idx, amount: t.amount }))
            .filter((item: any) => item.amount > 0n);

        if (activeTranches.length === 0) {
            throw new Error("Tidak ada saldo aktif untuk di-unstake.");
        }

        // Siapkan array untuk kontrak
        const trancheIdx = activeTranches.map((item: any) => item.idx);
        const amounts = activeTranches.map((item: any) => item.amount);

        args = [trancheIdx, amounts];
      }

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
      
      if (action === "stake") setAmount(""); // Reset input jika stake
      await fetchData(); // Refresh data

    } catch (e: any) {
      console.error(e);
      // Tampilkan pesan error yang bersih
      setStatus(e?.shortMessage || e?.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  // --- UI RENDER ---
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
          <label className="text-xs text-gray-500">Amount to Stake</label>
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
            // Disable tombol jika tidak ada saldo untuk di-unstake
            disabled={loading || stakedAmount <= 0}
            className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 hover:bg-red-700 transition-colors"
          >
            {loading ? "Processing..." : "Unstake All"}
          </button>
        </div>

        {/* Status Message */}
        {status && (
            <div className={`mt-4 text-center text-xs p-2 rounded border ${
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
