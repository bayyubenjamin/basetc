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
const RELAYER_ENDPOINT = "/api/sign-user-action"; // backend expects user/action/nonce/deadline/chainId/verifyingContract
type ActionType = "start" | "claim" | null;

// Compact large numbers
const formatNumber = (num: number) => {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(1) + "K";
  return num.toString();
};

// === Relayer signer (SESUIAI server kamu: perlu nonce & deadline dari client)
async function getRelayerSig(params: {
  user: `0x${string}`;
  action: "start" | "stop" | "claim";
  nonce: bigint;
  deadline: bigint;
}): Promise<{ signature: `0x${string}` }> {
  const resp = await fetch(RELAYER_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user: params.user,
      action: params.action,
      nonce: params.nonce.toString(),
      deadline: params.deadline.toString(),
      chainId: BASE_CHAIN_ID,
      verifyingContract: gameCoreAddress,
    }),
  });
  const json = await resp.json();
  if (!resp.ok) {
    throw new Error(json?.error || "bad_request from relayer");
  }
  const { signature } = json || {};
  if (!signature) throw new Error("relayer: no signature");
  return { signature: signature as `0x${string}` };
}

export default function Monitoring() {
  const { address, chainId } = useAccount();

  // UI state
  const [msg, setMsg] = useState("");
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Cosmetic mining stream (per-second animation)
  const [epochBudget, setEpochBudget] = useState<{ amt: number; sec: number }>({
    amt: 0,
    sec: 0,
  });
  const [lastSeenEpoch, setLastSeenEpoch] = useState<bigint | undefined>(undefined);

  // Track last action
  const [lastAction, setLastAction] = useState<ActionType>(null);

  // 1s ticker
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  // Auto-scroll terminal
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
// $BaseTC Balance (with dynamic decimals)
// ======================
const tokenDecimalsRead = useReadContract({
  address: baseTcAddress as `0x${string}`,
  abi: baseTcABI as any,
  functionName: "decimals",
});

const baseBal = useReadContract({
  address: baseTcAddress as `0x${string}`,
  abi: baseTcABI as any,
  functionName: "balanceOf",
  args: address ? [address] : undefined,
  query: { enabled: Boolean(address) },
});

// Nilai numerik
const tokenReadable = useMemo(() => {
  const bal = baseBal.data as bigint | undefined;
  const d = (tokenDecimalsRead.data as number | undefined) ?? 18;
  if (!bal) return 0;
  try {
    return Number(formatUnits(bal, d));
  } catch {
    return 0;
  }
}, [baseBal.data, tokenDecimalsRead.data]);

// Versi string untuk UI
const tokenShort = useMemo(
  () =>
    tokenReadable.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
  [tokenReadable]
);

const tokenExact = useMemo(() => {
  const bal = baseBal.data as bigint | undefined;
  const d = (tokenDecimalsRead.data as number | undefined) ?? 18;
  if (!bal) return "0";

  // pakai formatUnits langsung biar 18 desimal
  return formatUnits(bal, d); // string full dengan 18 angka di belakang koma
}, [baseBal.data, tokenDecimalsRead.data]);

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

  // legacy hashrate (always 0 in new contract)
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

  // NEW: pending reward (accumulator ROI)
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

  // NEW: miningUsage (to compute effective hashrate & badges)
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

  // Normalize & derived
  const eNowBn = epochNow.data as bigint | undefined;
  const eLen = (epochLength.data as bigint | undefined) ?? undefined;
  const sTime = (startTime.data as bigint | undefined) ?? undefined;
  const lastE = (lastToggleEpoch.data as bigint | undefined) ?? 0n;
  const cd = (toggleCooldown.data as bigint | undefined) ?? 0n;
  const prelaunch = Boolean((isPrelaunch.data as boolean | undefined) ?? false);
  const goLiveOn = Boolean((goLive.data as boolean | undefined) ?? false);
  const active = Boolean((miningActive.data as boolean | undefined) ?? false);

  // legacy hashrate (contract returns 0)
  const hrLegacy = useMemo(() => {
    const v = hashrate.data as bigint | undefined;
    return v ? Number(v) : 0;
  }, [hashrate.data]);

  // Base Unit per epoch (18 decimals)
  const baseUnitPerEpoch = useMemo(() => {
    const v = baseUnit.data as bigint | undefined;
    if (!v) return 0;
    return Number(formatUnits(v, 18));
  }, [baseUnit.data]);

  // Pending amount (enable claim if > 0)
  const pendingAmt = useMemo(() => {
    const v = pendingRw.data as bigint | undefined;
    return v ? Number(formatUnits(v, 18)) : 0;
  }, [pendingRw.data]);

  const canClaim = pendingAmt > 0;

  // Parse miningUsage -> used/idle & effective hashrate (display only; true reward pakai Base Unit)
  const {
    usedBasic,
    idleBasic,
    usedPro,
    idlePro,
    usedLegend,
    idleLegend,
    effectiveHashrate,
  } = useMemo(() => {
    const mu = miningUsage.data as
      | readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint]
      | undefined;
    // mu layout: bOwned, bUsed, bIdle, pOwned, pUsed, pIdle, lOwned, lUsed, lIdle
    const uB = mu ? Number(mu[1]) : 0;
    const iB = mu ? Number(mu[2]) : 0;
    const uP = mu ? Number(mu[4]) : 0;
    const iP = mu ? Number(mu[5]) : 0;
    const uL = mu ? Number(mu[7]) : 0;
    const iL = mu ? Number(mu[8]) : 0;
    // Display convention lama: 1 / 5 / 25
    const eff = uB * 1 + uP * 5 + uL * 25;
    return {
      usedBasic: uB,
      idleBasic: iB,
      usedPro: uP,
      idlePro: iP,
      usedLegend: uL,
      idleLegend: iL,
      effectiveHashrate: eff,
    };
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
  const {
    writeContract,
    data: txHash,
    isPending: writePending,
    error: writeError,
  } = useWriteContract();
  const {
    isLoading: receiptLoading,
    isSuccess,
    isError: receiptError,
  } = useWaitForTransactionReceipt({ hash: txHash });

  // Busy indicator that won't hang
  const busy = Boolean((writePending || receiptLoading) && lastAction !== null);

  // TX lifecycle
  useEffect(() => {
    if (isSuccess) {
      setMsg("Transaction confirmed.");
      addLog("Success: Transaction confirmed.");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess]);

  useEffect(() => {
    if (!writeError) return;
    const shortMsg =
      (writeError as any)?.shortMessage ||
      (writeError as any)?.message ||
      "Transaction failed to send";
    setMsg(shortMsg);
    addLog(`Error (write): ${shortMsg}`);
    setLastAction(null);
  }, [writeError]);

  useEffect(() => {
    if (!receiptError) return;
    setMsg("Transaction reverted. Please check the explorer for details.");
    addLog("Error: Transaction reverted at execution.");
    setLastAction(null);
  }, [receiptError]);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(""), 2800);
    return () => clearTimeout(t);
  }, [msg]);

  // Watch Claim events to live-refresh
  useWatchContractEvent({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    eventName: "Claimed",
    onLogs(logsRaw) {
      const logs = logsRaw as Array<{
        args?: { e?: bigint; user?: `0x${string}`; amount?: bigint };
      }>;
      const mine = logs.find(
        (l) =>
          (l?.args?.user ?? "").toLowerCase() === (address ?? "").toLowerCase()
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
  // Actions (WithSig) — versi stabil
  // ======================
  const onStart = async () => {
    if (!address) return setMsg("Please connect your wallet.");
    if (chainId && chainId !== BASE_CHAIN_ID)
      return setMsg("Please switch to Base Sepolia.");
    if (prelaunch && goLiveOn) return setMsg("Prelaunch is active. Wait for epoch 1.");
    if (!canToggle) return setMsg("Cooldown. Please try again later.");

    try {
      setMsg("");
      setLastAction("start");
      addLog("Requesting relayer signature for START...");

      // nonce FRESH dari chain (gunakan view hook terbaru)
      const nonce =
        (await (refetchNonce?.() || Promise.resolve({ data: userNonce.data })))?.data ??
        (userNonce.data as bigint | undefined) ??
        0n;

      // deadline 1 jam (lebih aman dari 15 menit)
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 60);

      const { signature } = await getRelayerSig({
        user: address as `0x${string}`,
        action: "start",
        nonce,
        deadline,
      });

      addLog("Sending startMiningWithSig...");
      writeContract({
        address: gameCoreAddress as `0x${string}`,
        abi: gameCoreABI as any,
        functionName: "startMiningWithSig",
        args: [address, nonce, deadline, signature],
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
    if (chainId && chainId !== BASE_CHAIN_ID)
      return setMsg("Please switch to Base Sepolia.");
    if (!canClaim) return setMsg("No pending rewards to claim.");

    const trySend = async () => {
      const freshNonce =
        (await (refetchNonce?.() || Promise.resolve({ data: userNonce.data })))?.data ??
        (userNonce.data as bigint | undefined) ??
        0n;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 60);

      const { signature } = await getRelayerSig({
        user: address as `0x${string}`,
        action: "claim",
        nonce: freshNonce,
        deadline,
      });

      writeContract({
        address: gameCoreAddress as `0x${string}`,
        abi: gameCoreABI as any,
        functionName: "claimWithSig",
        args: [address, freshNonce, deadline, signature],
        account: address as `0x${string}`,
        chain: baseSepolia,
        chainId: BASE_CHAIN_ID,
      });
    };

    try {
      setMsg("");
      setLastAction("claim");
      addLog("Requesting relayer signature for CLAIM...");
      await trySend();
    } catch (e: any) {
      const msg = (e?.message || "").toLowerCase();
      const shouldRetry =
        msg.includes("expired") ||
        msg.includes("deadline") ||
        msg.includes("bad_nonce") ||
        msg.includes("bad nonce") ||
        msg.includes("nonce");
      if (shouldRetry) {
        try {
          addLog("Retry: refresh nonce/deadline/signature from server...");
          await trySend();
          return;
        } catch (e2: any) {
          setLastAction(null);
          const em = e2?.message || "Failed to claim (retry)";
          setMsg(em);
          addLog(`Error (retry): ${em}`);
          return;
        }
      }
      setLastAction(null);
      const m = e?.message || "Failed to claim";
      setMsg(m);
      addLog(`Error: ${m}`);
    }
  };

  // ===== Reset cosmetic budget when epoch changes / mid-epoch open =====
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

      {/* Terminal */}
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
        {/* Effective Hashrate from miningUsage (display only) */}
        <StatCard title="Effective Hashrate" value={formatNumber(effectiveHashrate)} />
        {/* Base Unit: 2 decimals + tooltip exact */}
        <StatCardWithTooltip
          title="Base Unit / Epoch"
          valueShort={baseUnitPerEpoch.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
          valueExact={baseUnitPerEpoch.toLocaleString("en-US", {
            minimumFractionDigits: 12,
          })}
        />
<StatCardWithTooltip
  title="$BaseTC"
  valueShort={tokenShort}
  valueExact={tokenExact}
/>
      </div>
      
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Your Rigs</h2>
          {/* small usage badges */}
          <div className="text-[11px] text-neutral-400 space-x-2">
            <span>
              Basic x{String(countBasic)}{" "}
              {address ? `( ${usedBasic} used, ${idleBasic} idle )` : ""}
            </span>
            <span className="mx-1">•</span>
            <span>
              Pro x{String(countPro)}{" "}
              {address ? `( ${usedPro} used, ${idlePro} idle )` : ""}
            </span>
            <span className="mx-1">•</span>
            <span>
              Legend x{String(countLegend)}{" "}
              {address ? `( ${usedLegend} used, ${idleLegend} idle )` : ""}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <RigCard
            tier="Basic"
            count={String(countBasic)}
            image="/img/basic.png"
            owned={countBasic > 0n}
            badge={address ? `${usedBasic} used, ${idleBasic} idle` : undefined}
          />
          <RigCard
            tier="Pro"
            count={String(countPro)}
            image="/img/pro.png"
            owned={countPro > 0n}
            badge={address ? `${usedPro} used, ${idlePro} idle` : undefined}
          />
          <RigCard
            tier="Legend"
            count={String(countLegend)}
            image="/img/legend.png"
            owned={countLegend > 0n}
            badge={address ? `${usedLegend} used, ${idleLegend} idle` : undefined}
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
        {badge ? (
          <div className="text-[11px] text-neutral-400 mt-0.5">{badge}</div>
        ) : null}
      </div>
    </div>
  );
}

