"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { baseSepolia } from "viem/chains";
import {
  baseTcAddress,
  baseTcABI,
  rigNftAddress,
  rigNftABI,
  gameCoreAddress,
  gameCoreABI,
  chainId as BASE_CHAIN_ID,
} from "../lib/web3Config";

/**
 * Monitoring on-chain:
 * - Baca status miningActive, epochNow, getHashrate, getBaseUnit, isSupreme
 * - Baca BASIC/PRO/LEGEND id dari RigNFT + saldo NFT per tier
 * - Baca saldo $BaseTC user
 * - Start/Stop benar-benar mempengaruhi getHashrate (0 ketika stop)
 */

export default function Monitoring() {
  const { address } = useAccount();
  const [msg, setMsg] = useState<string>("");

  // ---------- Ambil ID tier dari RigNFT ----------
  const basicId = useReadContract({
    address: rigNftAddress as `0x${string}`,
    abi: rigNftABI as any,
    functionName: "BASIC",
  });
  const proId = useReadContract({
    address: rigNftAddress as `0x${string}`,
    abi: rigNftABI as any,
    functionName: "PRO",
  });
  const legendId = useReadContract({
    address: rigNftAddress as `0x${string}`,
    abi: rigNftABI as any,
    functionName: "LEGEND",
  });

  const BASIC = basicId.data as bigint | undefined;
  const PRO = proId.data as bigint | undefined;
  const LEGEND = legendId.data as bigint | undefined;

  // ---------- Saldo NFT per tier ----------
  const basicBal = useReadContract({
    address: rigNftAddress as `0x${string}`,
    abi: rigNftABI as any,
    functionName: "balanceOf",
    args: address && BASIC !== undefined ? [address, BASIC] : undefined,
    query: { enabled: Boolean(address && BASIC !== undefined) },
  });
  const proBal = useReadContract({
    address: rigNftAddress as `0x${string}`,
    abi: rigNftABI as any,
    functionName: "balanceOf",
    args: address && PRO !== undefined ? [address, PRO] : undefined,
    query: { enabled: Boolean(address && PRO !== undefined) },
  });
  const legendBal = useReadContract({
    address: rigNftAddress as `0x${string}`,
    abi: rigNftABI as any,
    functionName: "balanceOf",
    args: address && LEGEND !== undefined ? [address, LEGEND] : undefined,
    query: { enabled: Boolean(address && LEGEND !== undefined) },
  });

  const countBasic = (basicBal.data as bigint | undefined) ?? 0n;
  const countPro = (proBal.data as bigint | undefined) ?? 0n;
  const countLegend = (legendBal.data as bigint | undefined) ?? 0n;

  // ---------- Saldo $BaseTC ----------
  const baseBal = useReadContract({
    address: baseTcAddress as `0x${string}`,
    abi: baseTcABI as any,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });
  const tokenReadable = useMemo(() => {
    const v = baseBal.data as bigint | undefined;
    return v ? Number(v) / 1e18 : 0;
  }, [baseBal.data]);

  // ---------- GameCore reads ----------
  const epochNow = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "epochNow",
  });

  const miningActive = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "miningActive",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const hashrate = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "getHashrate",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const baseUnit = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "getBaseUnit",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const isSupreme = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "isSupreme",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const hrNum = useMemo(() => {
    const v = hashrate.data as bigint | undefined;
    return v ? Number(v) : 0;
  }, [hashrate.data]);

  const baseUnitNum = useMemo(() => {
    const v = baseUnit.data as bigint | undefined;
    return v ? Number(v) : 0;
  }, [baseUnit.data]);

  const active = Boolean((miningActive.data as boolean | undefined) ?? false);

  // ---------- Start / Stop ----------
  const { writeContract, data: txHash, isPending, error } = useWriteContract();
  const { isLoading: waitingReceipt, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  useEffect(() => {
    if (isSuccess) setMsg("Success.");
    if (error) {
      const e: any = error;
      setMsg(e?.shortMessage || e?.message || "Transaction failed");
    }
  }, [isSuccess, error]);

  // Setelah tx, kita biar wagmi re-read semua call di atas (wagmi otomatis revalidate on block).
  // Tambahkan juga efek sederhana agar pesan bersih setelah beberapa detik.
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 1500);
    return () => clearTimeout(t);
  }, [msg]);

  const onStart = () => {
    if (!address) return setMsg("Connect wallet first.");
    setMsg("");
    writeContract({
      address: gameCoreAddress as `0x${string}`,
      abi: gameCoreABI as any,
      functionName: "startMining",
      args: [],
      account: address as `0x${string}`,
      chain: baseSepolia,
      chainId: BASE_CHAIN_ID,
    });
  };

  const onStop = () => {
    if (!address) return setMsg("Connect wallet first.");
    setMsg("");
    writeContract({
      address: gameCoreAddress as `0x${string}`,
      abi: gameCoreABI as any,
      functionName: "stopMining",
      args: [],
      account: address as `0x${string}`,
      chain: baseSepolia,
      chainId: BASE_CHAIN_ID,
    });
  };

  // ---------- UI ----------
  return (
    <div className="space-y-4 px-4 pt-4 pb-8">
      {/* Header */}
      <header className="space-y-2">
        <h1 className="text-xl font-semibold">BaseTC Mining Console</h1>
        <p className="text-sm text-neutral-400">Farcaster Mini App</p>
      </header>

      {/* Ringkasan top */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs md:text-sm">
        <div className="bg-neutral-800 rounded-lg p-2">
          <div className="text-neutral-400">Epoch</div>
          <div className="text-lg font-semibold">
            {typeof epochNow.data !== "undefined" ? String(epochNow.data) : "-"}
          </div>
        </div>
        <div className="bg-neutral-800 rounded-lg p-2">
          <div className="text-neutral-400">Mining</div>
          <div className="text-lg font-semibold">{active ? "Active" : "Paused"}</div>
        </div>
        <div className="bg-neutral-800 rounded-lg p-2">
          <div className="text-neutral-400">$BaseTC</div>
          <div className="text-lg font-semibold">{tokenReadable.toFixed(3)}</div>
        </div>
      </div>

      {/* Stats on-chain */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs md:text-sm">
        <div className="bg-neutral-800 rounded-lg p-2">
          <div className="text-neutral-400">Hashrate</div>
          <div className="text-lg font-semibold">{hrNum}</div>
        </div>
        <div className="bg-neutral-800 rounded-lg p-2">
          <div className="text-neutral-400">Base Unit</div>
          <div className="text-lg font-semibold">{baseUnitNum}</div>
        </div>
        <div className="bg-neutral-800 rounded-lg p-2">
          <div className="text-neutral-400">Supreme</div>
          <div className="text-lg font-semibold">
            {String((isSupreme.data as boolean | undefined) ?? false)}
          </div>
        </div>
      </div>

      {/* NFT overview */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs md:text-sm">
        <div className="bg-neutral-800 rounded-lg p-2">
          <div className="text-neutral-400">Basic</div>
          <div className="text-lg font-semibold">x{String(countBasic)}</div>
        </div>
        <div className="bg-neutral-800 rounded-lg p-2">
          <div className="text-neutral-400">Pro</div>
          <div className="text-lg font-semibold">x{String(countPro)}</div>
        </div>
        <div className="bg-neutral-800 rounded-lg p-2">
          <div className="text-neutral-400">Legend</div>
          <div className="text-lg font-semibold">x{String(countLegend)}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between bg-neutral-800 rounded-lg p-3">
        <div className="flex items-baseline space-x-1">
          <span className="text-neutral-400 text-xs">Status:</span>
          <span className="text-xl font-semibold">{active ? "Active" : "Paused"}</span>
        </div>
        {active ? (
          <button
            onClick={onStop}
            disabled={!address || isPending || waitingReceipt}
            className="px-3 py-1.5 rounded-md text-sm font-medium text-white transition-colors disabled:bg-neutral-700 disabled:text-neutral-500"
            style={{ backgroundColor: "#dc2626" }}
            title={!address ? "Connect wallet first" : undefined}
          >
            {isPending || waitingReceipt ? "Stopping…" : "Stop"}
          </button>
        ) : (
          <button
            onClick={onStart}
            disabled={!address || isPending || waitingReceipt}
            className="px-3 py-1.5 rounded-md text-sm font-medium text-white transition-colors disabled:bg-neutral-700 disabled:text-neutral-500"
            style={{ backgroundColor: "#16a34a" }}
            title={!address ? "Connect wallet first" : undefined}
          >
            {isPending || waitingReceipt ? "Starting…" : "Start"}
          </button>
        )}
      </div>

      {!!msg && (
        <p className="text-xs text-green-400">
          {msg}
        </p>
      )}

      {/* Catatan kecil */}
      <p className="text-[10px] text-neutral-500">
        *Start/Stop memengaruhi <code>getHashrate</code> → saat Paused, hashrate = 0. Klaim & snapshot dikontrol oleh relayer.
      </p>
    </div>
  );
}

