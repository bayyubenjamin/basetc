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
 * Monitoring (versi pro):
 * - Status miningActive + badge
 * - Epoch now, progress waktu realtime, ETA next epoch
 * - Cooldown: toggleCooldown, lastToggleEpoch[user], hint "bisa toggle lagi di epoch X"
 * - Start/Stop: disable kalau cooldown / belum connect / tx pending
 * - NFT balances, hashrate, base unit, Supreme
 * - $BaseTC balance
 */

export default function Monitoring() {
  const { address } = useAccount();

  // ---------- State UI ----------
  const [msg, setMsg] = useState<string>("");
  const [now, setNow] = useState<number>(Math.floor(Date.now() / 1000)); // detik

  // realtime tick per 1s untuk progress bar epoch
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

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
  const epochLength = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "epochLength",
  });
  const startTime = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "startTime",
  });

  const miningActive = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "miningActive",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });
  const lastToggleEpoch = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "lastToggleEpoch",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });
  const toggleCooldown = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "toggleCooldown",
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
  const eNow = (epochNow.data as bigint | undefined) ?? undefined;
  const eLen = (epochLength.data as bigint | undefined) ?? undefined;
  const sTime = (startTime.data as bigint | undefined) ?? undefined;
  const lastE = (lastToggleEpoch.data as bigint | undefined) ?? 0n;
  const cd = (toggleCooldown.data as bigint | undefined) ?? 0n;

  // ---------- Epoch progress & ETA ----------
  const epochProgress = useMemo(() => {
    if (!sTime || !eLen) return { pct: 0, leftSec: 0 };
    const sinceStart = BigInt(now) - sTime;
    if (sinceStart < 0) return { pct: 0, leftSec: Number(eLen) };
    const pos = sinceStart % eLen;                 // detik posisi dalam epoch
    const left = eLen - pos;                       // sisa detik ke next epoch
    const pct = Number((pos * 100n) / eLen);       // 0..100
    return { pct, leftSec: Number(left) };
  }, [now, sTime, eLen]);

  const leftMMSS = useMemo(() => {
    const s = epochProgress.leftSec;
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, "0")}`;
  }, [epochProgress.leftSec]);

  // ---------- Cooldown logic ----------
  const canToggle = useMemo(() => {
    if (eNow === undefined) return false;
    // boleh toggle kalau epochNow >= lastToggle + cooldown
    return eNow >= lastE + cd;
  }, [eNow, lastE, cd]);

  const nextToggleEpoch = useMemo(() => {
    if (lastE === undefined) return undefined;
    return lastE + cd;
  }, [lastE, cd]);

  // ---------- Start / Stop ----------
  const { writeContract, data: txHash, isPending, error } = useWriteContract();
  const { isLoading: waitingReceipt, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  useEffect(() => {
    if (isSuccess) setMsg("Transaksi berhasil.");
    if (error) {
      const e: any = error;
      setMsg(e?.shortMessage || e?.message || "Transaction failed");
    }
  }, [isSuccess, error]);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 2500);
    return () => clearTimeout(t);
  }, [msg]);

  const onStart = () => {
    if (!address) return setMsg("Connect wallet dulu.");
    if (!canToggle) return setMsg("Masih cooldown. Coba lagi nanti.");
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
    if (!address) return setMsg("Connect wallet dulu.");
    if (!canToggle) return setMsg("Masih cooldown. Coba lagi nanti.");
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

  const busy = isPending || waitingReceipt;

  // ---------- UI ----------
  return (
    <div className="space-y-4 px-4 pt-4 pb-24">
      {/* Header */}
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Mining Console</h1>
        <p className="text-sm text-neutral-400">Real-time on-chain monitoring</p>
      </header>

      {/* Top Summary Card */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 space-y-3 shadow-lg">
        {/* Row 1: Epoch & Status */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-400">Epoch</span>
            <span className="text-lg font-semibold">
              {typeof eNow !== "undefined" ? String(eNow) : "—"}
            </span>
            <span className="text-xs text-neutral-500">
              {eLen ? `${Number(eLen)}s` : ""}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-1 rounded-md text-xs font-medium border ${
                active
                  ? "bg-green-500/10 text-green-400 border-green-500/30"
                  : "bg-neutral-800 text-neutral-300 border-neutral-700"
              }`}
            >
              {active ? "Active" : "Paused"}
            </span>
            <span className="text-xs text-neutral-500">
              {canToggle
                ? "Ready to toggle"
                : nextToggleEpoch !== undefined
                ? `Cooldown • next ≥ ${String(nextToggleEpoch)}`
                : ""}
            </span>
          </div>
        </div>

        {/* Row 2: Epoch progress */}
        <div>
          <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
            <span>Epoch progress</span>
            <span>Next in {leftMMSS}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-neutral-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500 transition-all"
              style={{ width: `${epochProgress.pct}%` }}
            />
          </div>
        </div>

        {/* Row 3: Controls */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-neutral-400">
            Cooldown: <span className="text-neutral-200">{String(cd ?? 0n)} epoch</span>
          </div>

          {active ? (
            <button
              onClick={onStop}
              disabled={!address || busy || !canToggle}
              className={`px-4 py-2 rounded-lg text-sm font-medium text-white shadow
                ${
                  !address || busy || !canToggle
                    ? "bg-neutral-700 text-neutral-400"
                    : "bg-red-600 hover:bg-red-500"
                }`}
              title={
                !address
                  ? "Connect wallet dulu"
                  : !canToggle
                  ? "Masih cooldown"
                  : undefined
              }
            >
              {busy ? "Stopping…" : "Stop Mining"}
            </button>
          ) : (
            <button
              onClick={onStart}
              disabled={!address || busy || !canToggle}
              className={`px-4 py-2 rounded-lg text-sm font-medium text-white shadow
                ${
                  !address || busy || !canToggle
                    ? "bg-neutral-700 text-neutral-400"
                    : "bg-emerald-600 hover:bg-emerald-500"
                }`}
              title={
                !address
                  ? "Connect wallet dulu"
                  : !canToggle
                  ? "Masih cooldown"
                  : undefined
              }
            >
              {busy ? "Starting…" : "Start Mining"}
            </button>
          )}
        </div>

        {/* Tx/Info message */}
        {!!msg && (
          <div className="text-xs text-emerald-400 pt-1">{msg}</div>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard title="Hashrate" value={String(hrNum)} />
        <StatCard title="Base Unit" value={String(baseUnitNum)} />
        <StatCard
          title="$BaseTC"
          value={tokenReadable.toFixed(3)}
        />
      </div>

      {/* Supreme & Inventory */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Profile Flags</div>
          <span
            className={`px-2 py-1 rounded-md text-xs border ${
              (isSupreme.data as boolean | undefined)
                ? "bg-purple-500/10 text-purple-300 border-purple-500/30"
                : "bg-neutral-800 text-neutral-300 border-neutral-700"
            }`}
          >
            Supreme: {String((isSupreme.data as boolean | undefined) ?? false)}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs md:text-sm">
          <MiniCard label="Basic" value={`x${String(countBasic)}`} />
          <MiniCard label="Pro" value={`x${String(countPro)}`} />
          <MiniCard label="Legend" value={`x${String(countLegend)}`} />
        </div>

        <p className="text-[10px] text-neutral-500">
          *Saat Paused, <code>getHashrate(user)</code> = 0. Reward epoch berjalan mengacu pada
          snapshot relayer setelah finalize.
        </p>
      </div>
    </div>
  );
}

/* --- Small presentational components --- */

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 text-center shadow">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-neutral-400">{title}</div>
    </div>
  );
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-neutral-800 rounded-lg p-3">
      <div className="text-neutral-400">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

