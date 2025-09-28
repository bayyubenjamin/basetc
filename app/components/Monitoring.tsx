"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useWatchContractEvent,
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
import { formatUnits } from "viem";

// ======================
// Utils & Constants
// ======================
const RELAYER_ENDPOINT = "/api/sign-user-action"; // backend returns { signature }
type ActionType = "start" | "claim" | null;

// Compact large numbers (for Hashrate)
const formatNumber = (num: number) => {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(1) + "K";
  return num.toString();
};

// Ask relayer to sign (user pays gas; relayer only authorizes)
async function getRelayerSig(params: {
  user: `0x${string}`;
  action: "start" | "stop" | "claim";
  nonce: bigint;
  deadline: bigint;
  chainId: number;
  verifyingContract: `0x${string}`;
}): Promise<string> {
  const resp = await fetch(RELAYER_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user: params.user,
      action: params.action,
      nonce: params.nonce.toString(),
      deadline: params.deadline.toString(),
      chainId: params.chainId,
      verifyingContract: params.verifyingContract,
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Relayer refused: ${text}`);
  }
  const { signature } = await resp.json();
  if (!signature) throw new Error("No signature returned by relayer");
  return signature as string;
}

export default function Monitoring() {
  const { address, chainId } = useAccount();

  // UI state
  const [msg, setMsg] = useState("");
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Mining stream budget (per-second animation; cosmetic only)
  const [epochBudget, setEpochBudget] = useState<{ amt: number; sec: number }>({
    amt: 0,
    sec: 0,
  });
  const [lastSeenEpoch, setLastSeenEpoch] = useState<bigint | undefined>(undefined);

  // Track last action for button labels + busy state
  const [lastAction, setLastAction] = useState<ActionType>(null);

  // 1s ticker
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  // Auto-scroll terminal to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLogs]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setTerminalLogs((prev) => [...prev, `[${timestamp}] ${message}`].slice(-200));
  };

  // ======================
  // NFT IDs & Balances
  // ======================
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

  // ======================
  // $BaseTC Balance
  // ======================
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

  // ======================
  // GameCore Reads (latest ABI)
  // ======================
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
  const isPrelaunch = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "isPrelaunch",
  });
  const goLive = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "goLive",
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

  // NEW: pending reward (accumulator)
  const pendingRw = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "pending",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  // NEW: sessionEndAt (daily ritual auto-stop)
  const sessionEndAt = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "sessionEndAt",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  // NEW: nonces for WithSig
  const userNonce = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "nonces",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  // NEW: mining usage (used/idle caps per tier)
  const miningUsage = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "miningUsage",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  // Refs to refetch after tx
  const { refetch: refetchEpochNow } = epochNow as any;
  const { refetch: refetchMiningActive } = miningActive as any;
  const { refetch: refetchBaseUnit } = baseUnit as any;
  const { refetch: refetchBaseBal } = baseBal as any;
  const { refetch: refetchHashrate } = hashrate as any;
  const { refetch: refetchPending } = pendingRw as any;
  const { refetch: refetchSessionEnd } = sessionEndAt as any;
  const { refetch: refetchNonce } = userNonce as any;
  const { refetch: refetchUsage } = miningUsage as any;

  // Normalize & derived states
  const eNowBn = epochNow.data as bigint | undefined;
  const eLen = (epochLength.data as bigint | undefined) ?? undefined;
  const sTime = (startTime.data as bigint | undefined) ?? undefined;
  const lastE = (lastToggleEpoch.data as bigint | undefined) ?? 0n;
  const cd = (toggleCooldown.data as bigint | undefined) ?? 0n;
  const prelaunch = Boolean((isPrelaunch.data as boolean | undefined) ?? false);
  const goLiveOn = Boolean((goLive.data as boolean | undefined) ?? false);
  const active = Boolean((miningActive.data as boolean | undefined) ?? false);

  const hrNum = useMemo(() => {
    const v = hashrate.data as bigint | undefined;
    return v ? Number(v) : 0;
  }, [hashrate.data]);

  // Base Unit per epoch (18 decimals)
  const baseUnitPerEpoch = useMemo(() => {
    const v = baseUnit.data as bigint | undefined;
    if (!v) return 0;
    return Number(formatUnits(v, 18)); // e.g., 1.665
  }, [baseUnit.data]);

  // Pending amount (enable claim if > 0)
  const pendingAmt = useMemo(() => {
    const v = pendingRw.data as bigint | undefined;
    return v ? Number(formatUnits(v, 18)) : 0;
  }, [pendingRw.data]);

  const canClaim = pendingAmt > 0;

  // Parse miningUsage → badges per tier
  const usageParsed = useMemo(() => {
    const d = miningUsage.data as
      | readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint]
      | undefined;
    if (!d) {
      return {
        basicBadge: undefined,
        proBadge: undefined,
        legendBadge: undefined,
      };
    }
    const [bOwned, bUsed, bIdle, pOwned, pUsed, pIdle, lOwned, lUsed, lIdle] = d;
    const bb = `Basic x${Number(bOwned)} (${Number(bUsed)} used, ${Number(bIdle)} idle)`;
    const pb = `Pro x${Number(pOwned)} (${Number(pUsed)} used, ${Number(pIdle)} idle)`;
    const lb = `Legend x${Number(lOwned)} (${Number(lUsed)} used, ${Number(lIdle)} idle)`;
    return { basicBadge: bb, proBadge: pb, legendBadge: lb };
  }, [miningUsage.data]);

  // Epoch progress & ETA
  const epochProgress = useMemo(() => {
    if (!sTime || !eLen) return { pct: 0, leftSec: 0 };
    const sinceStart = BigInt(now) - sTime;
    if (sinceStart < 0n) return { pct: 0, leftSec: Number(eLen) };
    const pos = sinceStart % eLen;
    const left = eLen - pos;
    const pct = Number((pos * 100n) / eLen);
    return { pct, leftSec: Number(left) };
  }, [now, sTime, eLen]);

  const leftMMSS = useMemo(() => {
    const s = epochProgress.leftSec;
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m ${r.toString().padStart(2, "0")}s`;
    return `${m}:${r.toString().padStart(2, "0")}`;
  }, [epochProgress.leftSec]);

  const canToggle = useMemo(() => {
    const eNow = eNowBn;
    if (eNow === undefined) return false;
    if (prelaunch && goLiveOn) return false;
    return eNow >= lastE + cd;
  }, [eNowBn, lastE, cd, prelaunch, goLiveOn]);

  // ======================
  // TX (user pays gas)
  // ======================
  const { writeContract, data: txHash, isPending, error } = useWriteContract();
  const { isLoading: waitingReceipt, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  // Busy indicator that won't hang
  const busy = Boolean((isPending || waitingReceipt) && lastAction !== null);

  // TX lifecycle
  useEffect(() => {
    if (isSuccess) {
      setMsg("Transaction confirmed.");
      addLog(`Success: Transaction confirmed.`);
      // Refresh important reads
      refetchEpochNow?.();
      refetchMiningActive?.();
      refetchBaseUnit?.();
      refetchBaseBal?.();
      refetchHashrate?.();
      refetchPending?.();
      refetchSessionEnd?.();
      refetchNonce?.();
      refetchUsage?.();
      setLastAction(null);
    }
    if (error) {
      const e: any = error;
      const shortMsg = e?.shortMessage || e?.message || "Transaction failed";
      setMsg(shortMsg);
      addLog(`Error: ${shortMsg}`);
      setLastAction(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, error]);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 2800);
    return () => clearTimeout(t);
  }, [msg]);

  // ======================
  // Watch on-chain Claim event → auto-update UI (TS-safe cast)
  // ======================
  useWatchContractEvent({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    eventName: "Claimed",
    onLogs(logsRaw) {
      const logs = logsRaw as Array<{
        args?: { e?: bigint; user?: `0x${string}`; amount?: bigint };
      }>;
      const mine = logs.find(
        (l) => (l?.args?.user ?? "").toLowerCase() === (address ?? "").toLowerCase()
      );
      if (!mine || !mine.args) return;

      const amt = Number(formatUnits(mine.args.amount ?? 0n, 18));
      addLog(`Claim success for epoch #${String(mine.args.e)}: +${amt.toFixed(6)}`);

      refetchEpochNow?.();
      refetchMiningActive?.();
      refetchBaseUnit?.();
      refetchBaseBal?.();
      refetchHashrate?.();
      refetchPending?.();
      refetchSessionEnd?.();
      refetchNonce?.();
      refetchUsage?.();

      setLastAction(null);
      setMsg("Transaction confirmed.");
    },
  });

  // ======================
  // Actions (WithSig)
  // ======================
  const onStart = async () => {
    if (!address) return setMsg("Please connect your wallet.");
    if (chainId && chainId !== BASE_CHAIN_ID) return setMsg("Please switch to Base Sepolia.");
    if (prelaunch && goLiveOn) return setMsg("Prelaunch is active. Wait for epoch 1.");
    if (!canToggle) return setMsg("Cooldown. Please try again later.");

    try {
      setMsg("");
      setLastAction("start");
      addLog("Requesting relayer signature for START...");
      const nonce = (userNonce.data as bigint | undefined) ?? 0n;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 15 * 60); // now + 15 minutes
      const relayerSig = await getRelayerSig({
        user: address as `0x${string}`,
        action: "start",
        nonce,
        deadline,
        chainId: chainId ?? BASE_CHAIN_ID,
        verifyingContract: gameCoreAddress as `0x${string}`,
      });

      addLog("Sending startMiningWithSig...");
      writeContract({
        address: gameCoreAddress as `0x${string}`,
        abi: gameCoreABI as any,
        functionName: "startMiningWithSig",
        args: [address, nonce, deadline, relayerSig],
        account: address as `0x${string}`,
        chain: baseSepolia,
        chainId: BASE_CHAIN_ID,
      });
    } catch (e: any) {
      setLastAction(null);
      const m = e?.message || "Failed to start";
      setMsg(m);
      addLog(`Error: ${m}`);
    }
  };

  const onClaim = async () => {
    if (!address) return setMsg("Please connect your wallet.");
    if (chainId && chainId !== BASE_CHAIN_ID) return setMsg("Please switch to Base Sepolia.");
    if (!canClaim) return setMsg("No pending rewards to claim.");

    try {
      setMsg("");
      setLastAction("claim");
      addLog("Requesting relayer signature for CLAIM...");
      const nonce = (userNonce.data as bigint | undefined) ?? 0n;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 15 * 60); // now + 15 minutes
      const relayerSig = await getRelayerSig({
        user: address as `0x${string}`,
        action: "claim",
        nonce,
        deadline,
        chainId: chainId ?? BASE_CHAIN_ID,
        verifyingContract: gameCoreAddress as `0x${string}`,
      });

      addLog("Sending claimWithSig...");
      writeContract({
        address: gameCoreAddress as `0x${string}`,
        abi: gameCoreABI as any,
        functionName: "claimWithSig",
        args: [address, nonce, deadline, relayerSig],
        account: address as `0x${string}`,
        chain: baseSepolia,
        chainId: BASE_CHAIN_ID,
      });
    } catch (e: any) {
      setLastAction(null);
      const m = e?.message || "Failed to claim";
      setMsg(m);
      addLog(`Error: ${m}`);
    }
  };

  // ===== Reset cosmetic budget when epoch changes / or when entering mid-epoch =====
  useEffect(() => {
    if (!eLen || !eNowBn) return;
    const totalSec = Number(eLen);
    const leftSec = epochProgress.leftSec || totalSec;

    if (lastSeenEpoch === undefined || eNowBn !== lastSeenEpoch) {
      setLastSeenEpoch(eNowBn);
    }

    const proportion = totalSec > 0 ? leftSec / totalSec : 0;
    const initAmt = baseUnitPerEpoch * proportion;
    setEpochBudget({ amt: initAmt, sec: leftSec });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eNowBn, eLen, baseUnitPerEpoch, epochProgress.leftSec]);

  // ===== Cosmetic per-second stream (randomized but totals match budget) =====
  useEffect(() => {
    if (!active || (prelaunch && goLiveOn)) return;
    if (epochBudget.sec <= 0 || epochBudget.amt <= 0) return;

    setEpochBudget((prev) => {
      if (prev.sec <= 0 || prev.amt <= 0) return prev;

      const baseline = prev.amt / prev.sec;
      const jitter = 0.85 + Math.random() * 0.3; // 0.85..1.15
      let inc = baseline * jitter;
      if (inc > prev.amt) inc = prev.amt;

      const next = { amt: prev.amt - inc, sec: prev.sec - 1 };
      addLog(`+${inc.toFixed(6)} Base Unit (left: ${next.amt.toFixed(6)})`);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, active, prelaunch, goLiveOn]);

  // =========== UI ===========
  return (
    <div className="space-y-4 px-4 pt-4 pb-24">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold">Mining Console</h1>
        <p className="text-sm text-neutral-400">Real-time on-chain monitoring</p>
      </header>

      <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 space-y-3 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-400">Epoch</span>
            <span className="text-lg font-semibold">
              {typeof eNowBn !== "undefined" ? String(eNowBn) : "—"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-1 rounded-md text-xs font-medium border ${
                prelaunch && goLiveOn
                  ? "bg-yellow-500/10 text-yellow-300 border-yellow-500/30"
                  : active
                  ? "bg-green-500/10 text-green-400 border-green-500/30"
                  : "bg-neutral-800 text-neutral-300 border-neutral-700"
              }`}
            >
              {prelaunch && goLiveOn ? "Prelaunch" : active ? "Active" : "Paused"}
            </span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs text-neutral-400 mb-1">
            <span>Epoch progress</span>
            <span>Next in {leftMMSS}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-neutral-800 overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${epochProgress.pct}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-neutral-400">
            Cooldown: <span className="text-neutral-200">{String(cd ?? 0n)} epoch</span>
          </div>

        {/* When ACTIVE → Claim (grey if pending=0). When NOT active → Start */}
          {active ? (
            <button
              onClick={onClaim}
              disabled={!address || busy || !canClaim}
              className={`px-4 py-2 rounded-lg text-sm font-medium text-white shadow ${
                !address || busy || !canClaim
                  ? "bg-neutral-700 text-neutral-400"
                  : "bg-indigo-600 hover:bg-indigo-500"
              }`}
              title={canClaim ? "Claim rewards" : "No rewards available yet"}
            >
              {busy && lastAction === "claim" ? "Claiming…" : "Claim"}
            </button>
          ) : (
            <button
              onClick={onStart}
              disabled={!address || busy || !canToggle || (prelaunch && goLiveOn)}
              className={`px-4 py-2 rounded-lg text-sm font-medium text-white shadow ${
                !address || busy || !canToggle || (prelaunch && goLiveOn)
                  ? "bg-neutral-700 text-neutral-400"
                  : "bg-emerald-600 hover:bg-emerald-500"
              }`}
            >
              {busy && lastAction === "start" ? "Starting…" : "Start Mining"}
            </button>
          )}
        </div>
        {!!msg && <div className="text-xs text-emerald-400 pt-1">{msg}</div>}
      </div>

      {/* Terminal: latest at bottom + auto-scroll */}
      <div
        ref={terminalRef}
        className="bg-black/50 border border-neutral-800 rounded-lg p-3 font-mono text-xs text-green-400 space-y-1 h-32 overflow-y-auto"
      >
        <p>&gt; Terminal ready...</p>
        {terminalLogs.map((log, i) => (
          <p key={i}>&gt; {log}</p>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatCard title="Hashrate" value={formatNumber(hrNum)} />
        {/* Base Unit: 2 decimals + tooltip exact */}
        <StatCardWithTooltip
          title="Base Unit"
          valueShort={baseUnitPerEpoch.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
          valueExact={baseUnitPerEpoch.toLocaleString("en-US", {
            minimumFractionDigits: 12,
          })}
        />
        <StatCard title="$BaseTC" value={tokenReadable.toFixed(3)} />
      </div>

      <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-semibold">Your Rigs</h2>
        <div className="grid grid-cols-3 gap-3">
          <RigCard
            tier="Basic"
            count={String(countBasic)}
            image="/img/basic.png"
            owned={countBasic > 0n}
            badge={usageParsed.basicBadge}
          />
          <RigCard
            tier="Pro"
            count={String(countPro)}
            image="/img/pro.png"
            owned={countPro > 0n}
            badge={usageParsed.proBadge}
          />
          <RigCard
            tier="Legend"
            count={String(countLegend)}
            image="/img/legend.png"
            owned={countLegend > 0n}
            badge={usageParsed.legendBadge}
          />
        </div>
      </div>
    </div>
  );
}

// --- Components ---

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 text-center shadow">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-neutral-400">{title}</div>
    </div>
  );
}

function StatCardWithTooltip({
  title,
  valueShort,
  valueExact,
}: {
  title: string;
  valueShort: string;
  valueExact: string;
}) {
  return (
    <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 text-center shadow">
      <div className="relative inline-block group">
        <div className="text-lg font-semibold cursor-help">{valueShort}</div>
        {/* Tooltip (top) */}
        <div
          className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full
                        hidden group-hover:block bg-neutral-800 text-neutral-100 text-xs
                        px-2 py-1 rounded shadow-lg whitespace-nowrap border border-neutral-700"
        >
          Exact: {valueExact}
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full
                          w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-neutral-800"
          />
        </div>
      </div>
      <div className="text-xs text-neutral-400 mt-1">{title}</div>
    </div>
  );
}

function RigCard({
  tier,
  count,
  image,
  owned,
  badge,
}: {
  tier: string;
  count: string;
  image: string;
  owned: boolean;
  badge?: string;
}) {
  return (
    <div className="bg-neutral-800 rounded-lg p-3 text-center space-y-2">
      <div
        className={`relative aspect-square transition-all duration-300 ${
          !owned ? "filter blur-sm opacity-50" : ""
        }`}
      >
        <Image src={image} alt={`${tier} Rig`} fill style={{ objectFit: "contain" }} />
      </div>
      <div>
        <div className="text-sm text-neutral-400">{tier}</div>
        <div className="text-lg font-semibold">x{count}</div>
        {badge && (
          <div className="mt-1 text-[11px] text-neutral-400">
            {badge}
          </div>
        )}
      </div>
    </div>
  );
}

