// app/components/Monitoring.tsx
"use client";

import { useEffect, useMemo, useRef, useState, type FC } from "react";
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

/* ======================
   Utils & Constants
   ====================== */
const RELAYER_ENDPOINT = "/api/sign-user-action";
type ActionType = "start" | "claim" | null;

const formatNumber = (num: number) => {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(1) + "K";
  return num.toString();
};

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
  if (!resp.ok) throw new Error(json?.error || "Relayer returned bad_request");
  const { signature } = json || {};
  if (!signature) throw new Error("Relayer did not return a signature");
  return { signature: signature as `0x${string}` };
}

/* ======================
   UI helpers: overlay + popup
   ====================== */
const LoadingOverlay: FC<{ show: boolean; label?: string }> = ({ show, label }) => {
  if (!show) return null;
  return (
    <>
      <div className="fixed inset-0 z-[1000] bg-black/30 backdrop-blur-[1px]" />
      <div className="fixed inset-0 z-[1010] grid place-items-center p-4">
        <div className="w-full max-w-sm flex items-center gap-3 rounded-xl bg-neutral-900 text-white border border-white/10 px-4 py-3 shadow-xl">
          <div className="h-5 w-5 rounded-full border-2 border-white/30 border-t-transparent animate-spin" />
          <div className="text-sm leading-5 whitespace-pre-line">{label ?? "Processing…"}</div>
        </div>
      </div>
    </>
  );
};

const CenterPopup: FC<{ open: boolean; message: string; onOK: () => void }> = ({ open, message, onOK }) => {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-[1100] bg-black/60 backdrop-blur-sm" />
      <div className="fixed inset-0 z-[1200] grid place-items-center p-4">
        <div className="w-full max-w-sm rounded-2xl bg-neutral-900 text-white shadow-2xl border border-white/10">
          <div className="p-5">
            <div className="text-center text-sm leading-relaxed whitespace-pre-line">
              {message || "Done."}
            </div>
            <div className="mt-5 flex justify-center">
              <button
                onClick={onOK}
                className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-500 active:scale-[0.99]"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

/* ======================
   Component
   ====================== */
const Monitoring: FC = () => {
  const { address, chainId } = useAccount();

  // UI state
  const [statusText, setStatusText] = useState("");
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Processing & popup
  const [loading, setLoading] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const [popupMsg, setPopupMsg] = useState("");

  // Live mining (baseline + elapsed)
  const [liveBaseStart, setLiveBaseStart] = useState<number>(0);
  const [liveStartTs, setLiveStartTs] = useState<number>(0);
  const [lastAction, setLastAction] = useState<ActionType>(null);

  // 1s ticker
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  // Terminal autoscroll
  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [terminalLogs]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setTerminalLogs((prev) => [...prev, `[${timestamp}] ${message}`].slice(-300));
  };

  /* ======================
     NFT IDs & Balances
     ====================== */
  const basicId = useReadContract({ address: rigNftAddress as `0x${string}`, abi: rigNftABI as any, functionName: "BASIC" });
  const proId = useReadContract({ address: rigNftAddress as `0x${string}`, abi: rigNftABI as any, functionName: "PRO" });
  const legendId = useReadContract({ address: rigNftAddress as `0x${string}`, abi: rigNftABI as any, functionName: "LEGEND" });

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

  /* ======================
     $BaseTC Balance
     ====================== */
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
    return formatUnits(bal, d);
  }, [baseBal.data, tokenDecimalsRead.data]);

  /* ======================
     GameCore Reads
     ====================== */
  const epochNow = useReadContract({ address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: "epochNow" });
  const epochLength = useReadContract({ address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: "epochLength" });
  const startTime = useReadContract({ address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: "startTime" });
  const isPrelaunch = useReadContract({ address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: "isPrelaunch" });
  const goLive = useReadContract({ address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: "goLive" });

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

  const toggleCooldown = useReadContract({ address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: "toggleCooldown" });

  // legacy hashrate (kept for compatibility)
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

  const pendingRw = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "pending",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const sessionEndAt = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "sessionEndAt",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const userNonce = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "nonces",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const miningUsage = useReadContract({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    functionName: "miningUsage",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  // Refetch handles
  const { refetch: refetchEpochNow } = epochNow as any;
  const { refetch: refetchMiningActive } = miningActive as any;
  const { refetch: refetchBaseUnit } = baseUnit as any;
  const { refetch: refetchBaseBal } = baseBal as any;
  const { refetch: refetchHashrate } = hashrate as any;
  const { refetch: refetchPending } = pendingRw as any;
  const { refetch: refetchSessionEnd } = sessionEndAt as any;
  const { refetch: refetchNonce } = userNonce as any;
  const { refetch: refetchUsage } = miningUsage as any;

  // Normalize
  const eNowBn = epochNow.data as bigint | undefined;
  const eLen = (epochLength.data as bigint | undefined) ?? undefined;
  const sTime = (startTime.data as bigint | undefined) ?? undefined;
  const lastE = (lastToggleEpoch.data as bigint | undefined) ?? 0n;
  const cd = (toggleCooldown.data as bigint | undefined) ?? 0n;
  const prelaunch = Boolean((isPrelaunch.data as boolean | undefined) ?? false);
  const goLiveOn = Boolean((goLive.data as boolean | undefined) ?? false);
  const active = Boolean((miningActive.data as boolean | undefined) ?? false);

  const _hrLegacy = useMemo(() => {
    const v = hashrate.data as bigint | undefined;
    return v ? Number(v) : 0;
  }, [hashrate.data]);

  const baseUnitPerEpoch = useMemo(() => {
    const v = baseUnit.data as bigint | undefined;
    if (!v) return 0;
    return Number(formatUnits(v, 18));
  }, [baseUnit.data]);

  const pendingAmt = useMemo(() => {
    const v = pendingRw.data as bigint | undefined;
    return v ? Number(formatUnits(v, 18)) : 0;
  }, [pendingRw.data]);

  const canClaim = pendingAmt > 0;

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
    const uB = mu ? Number(mu[1]) : 0;
    const iB = mu ? Number(mu[2]) : 0;
    const uP = mu ? Number(mu[4]) : 0;
    const iP = mu ? Number(mu[5]) : 0;
    const uL = mu ? Number(mu[7]) : 0;
    const iL = mu ? Number(mu[8]) : 0;
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

  /* ======================
     TX (user pays gas)
     ====================== */
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

  const busy = Boolean(writePending || receiptLoading);

  // Stop manual overlay once tx is broadcast
  const [loggedHash, setLoggedHash] = useState<string | null>(null);
  useEffect(() => {
    if (txHash && txHash !== loggedHash) {
      addLog(`Tx sent: ${txHash}`);
      setLoggedHash(txHash);
      setStatusText("Waiting for confirmation…");
      setLoading(false);
    }
  }, [txHash, loggedHash]);

  // Waiting receipt logs
  const [wasWaiting, setWasWaiting] = useState(false);
  useEffect(() => {
    if (receiptLoading && !wasWaiting) {
      setWasWaiting(true);
      addLog("On-chain: awaiting confirmations…");
      setStatusText("Waiting for confirmation…");
    }
    if (!receiptLoading && wasWaiting) setWasWaiting(false);
  }, [receiptLoading, wasWaiting]);

  // Helper: refetch all & reset baseline to real chain values
  const refreshAll = async (note?: string) => {
    await Promise.allSettled([
      refetchEpochNow?.(),
      refetchMiningActive?.(),
      refetchBaseUnit?.(),
      refetchBaseBal?.(),
      refetchHashrate?.(),
      refetchPending?.(),
      refetchSessionEnd?.(),
      refetchNonce?.(),
      refetchUsage?.(),
    ]);
    const freshPending = (await (refetchPending?.() || Promise.resolve({ data: pendingRw.data })))?.data as bigint | undefined;
    const pendingStart = freshPending ? Number(formatUnits(freshPending, 18)) : 0;
    setLiveBaseStart(pendingStart);
    setLiveStartTs(Math.floor(Date.now() / 1000));
    if (note) addLog(note);
  };

  // Success
  useEffect(() => {
    if (!isSuccess) return;
    setStatusText("Transaction confirmed.");
    addLog("Success: Transaction confirmed.");
    setLoading(false);
    refreshAll(lastAction === "start" ? "Mining session started." : "State updated after tx.");
    setLastAction(null);
    setLoggedHash(null);
  }, [isSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  // Errors
  useEffect(() => {
    if (!writeError) return;
    const shortMsg =
      (writeError as any)?.shortMessage ||
      (writeError as any)?.message ||
      "Transaction failed to send";
    setStatusText(shortMsg);
    addLog(`Error (write): ${shortMsg}`);
    setLoading(false);
    setLoggedHash(null);
    setLastAction(null);
  }, [writeError]);

  useEffect(() => {
    if (!receiptError) return;
    setStatusText("Transaction reverted. Check the explorer for details.");
    addLog("Error: Transaction reverted at execution.");
    setLoading(false);
    setLoggedHash(null);
    setLastAction(null);
  }, [receiptError]);

  /* ======================
     Events: Claimed (ground truth amount)
     ====================== */
  useWatchContractEvent({
    address: gameCoreAddress as `0x${string}`,
    abi: gameCoreABI as any,
    eventName: "Claimed",
    onLogs: async (logsRaw) => {
      const logs = logsRaw as Array<{ args?: { e?: bigint; user?: `0x${string}`; amount?: bigint } }>;
      const mine = logs.find(
        (l) => (l?.args?.user ?? "").toLowerCase() === (address ?? "").toLowerCase()
      );
      if (!mine || !mine.args) return;

      const amt = Number(formatUnits(mine.args.amount ?? 0n, 18));
      addLog(`Claim success for epoch #${String(mine.args.e)}: +${amt.toFixed(6)} $BaseTC`);

      setStatusText(`Claimed: +${amt.toFixed(6)} $BaseTC`);
      setPopupMsg(`Claim successful!\nYou received +${amt.toFixed(6)} $BaseTC.`);
      setPopupOpen(true);

      // Refresh reads without page reload
      await refreshAll("State updated after claim.");
      setLastAction(null);
    },
  });

  /* ======================
     Actions (WithSig)
     ====================== */
  const onStart = async () => {
    if (!address) { setStatusText("Please connect your wallet."); return; }
    if (chainId && chainId !== BASE_CHAIN_ID) { setStatusText("Please switch to Base Sepolia."); return; }
    if (prelaunch && goLiveOn) { setStatusText("Prelaunch is active. Wait for epoch 1."); return; }
    if (!canToggle) { setStatusText("In cooldown. Please try again later."); return; }

    try {
      setLoading(true);
      setStatusText("Requesting relayer signature (START) …");
      setLastAction("start");

      const nonce =
        (await (refetchNonce?.() || Promise.resolve({ data: userNonce.data })))?.data ??
        (userNonce.data as bigint | undefined) ?? 0n;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 60);
      const { signature } = await getRelayerSig({ user: address as `0x${string}`, action: "start", nonce, deadline });

      setStatusText("Sending startMiningWithSig …");
      addLog("Sending startMiningWithSig …");

      writeContract({
        address: gameCoreAddress as `0x${string}`,
        abi: gameCoreABI as any,
        functionName: "startMiningWithSig",
        args: [address, nonce, deadline, signature],
        account: address as `0x${string}`,
        chain: baseSepolia,
        chainId: BASE_CHAIN_ID,
      });

      // Baseline snapshot before receipt
      const freshPending = (await (refetchPending?.() || Promise.resolve({ data: pendingRw.data })))?.data as bigint | undefined;
      const pendingStart = freshPending ? Number(formatUnits(freshPending, 18)) : 0;
      setLiveBaseStart(pendingStart);
      setLiveStartTs(Math.floor(Date.now() / 1000));
    } catch (e: any) {
      const m = e?.message || "Failed to start";
      setStatusText(m);
      addLog(`Error: ${m}`);
      setLoading(false);
      setLastAction(null);
    }
  };

  const onClaim = async () => {
    if (!address) { setStatusText("Please connect your wallet."); return; }
    if (chainId && chainId !== BASE_CHAIN_ID) { setStatusText("Please switch to Base Sepolia."); return; }
    if (!canClaim) { setStatusText("No pending rewards to claim."); return; }

    const trySend = async () => {
      const freshNonce =
        (await (refetchNonce?.() || Promise.resolve({ data: userNonce.data })))?.data ??
        (userNonce.data as bigint | undefined) ?? 0n;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 60);
      const { signature } = await getRelayerSig({ user: address as `0x${string}`, action: "claim", nonce: freshNonce, deadline });

      setStatusText("Sending claimWithSig …");
      addLog("Sending claimWithSig …");

      writeContract({
        address: gameCoreAddress as `0x${string}`,
        abi: gameCoreABI as any,
        functionName: "claimWithSig",
        args: [address, freshNonce, deadline, signature],
        account: address as `0x${string}`,
        chain: baseSepolia,
        chainId: BASE_CHAIN_ID,
      });

      setLoading(false); // wagmi busy takes over
    };

    try {
      setLoading(true);
      setStatusText("Requesting relayer signature (CLAIM) …");
      setLastAction("claim");
      await trySend();
    } catch (e: any) {
      const m = (e?.message || "").toLowerCase();
      const shouldRetry = m.includes("expired") || m.includes("deadline") || m.includes("bad_nonce") || m.includes("bad nonce") || m.includes("nonce");
      if (shouldRetry) {
        try {
          addLog("Retrying claim with refreshed nonce/deadline …");
          setStatusText("Retrying claim …");
          await trySend();
        } catch (e2: any) {
          const em = e2?.message || "Failed to claim (retry)";
          setStatusText(em);
          addLog(`Error (retry): ${em}`);
          setLoading(false);
          setLastAction(null);
        }
        return;
      }
      const em = e?.message || "Failed to claim";
      setStatusText(em);
      addLog(`Error: ${em}`);
      setLoading(false);
      setLastAction(null);
    }
  };

  /* ======================
     Realtime meter + heartbeat (uses on-chain polling)
     ====================== */
  const perSecRate = useMemo(() => {
    if (!eLen || !baseUnitPerEpoch) return 0;
    const seconds = Number(eLen);
    return seconds > 0 ? baseUnitPerEpoch / seconds : 0;
  }, [eLen, baseUnitPerEpoch]);

  // recalibrate baseline when active toggles
  useEffect(() => {
    if (!active) return;
    const p = pendingAmt;
    setLiveBaseStart(p);
    setLiveStartTs(Math.floor(Date.now() / 1000));
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  // strictly real-time value = max(pending on-chain, baseline + rate*elapsed)
  const liveMiningNow = useMemo(() => {
    if (!active) return 0;
    if (!perSecRate) return pendingAmt;
    const elapsed = Math.max(0, now - (liveStartTs || now));
    const est = liveBaseStart + perSecRate * elapsed;
    return Math.max(est, pendingAmt);
  }, [active, perSecRate, now, liveStartTs, liveBaseStart, pendingAmt]);

  // Poll on-chain every 5s while active to keep numbers honest
  useEffect(() => {
    if (!active) return;
    const id = setInterval(async () => {
      await Promise.allSettled([refetchPending?.(), refetchEpochNow?.(), refetchUsage?.()]);
    }, 5000);
    return () => clearInterval(id);
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  // Heartbeat logs every ~5s while active
  const [lastBeatTs, setLastBeatTs] = useState<number>(0);
  useEffect(() => {
    if (!active) return;
    const t = Math.floor(Date.now() / 1000);
    if (t - lastBeatTs >= 5) {
      setLastBeatTs(t);
      const perEpochFromRigs = baseUnitPerEpoch; // already per-user, contract-derived
      addLog(
        `Mining… pending (on-chain) ${pendingAmt.toFixed(6)} $BaseTC | est ${liveMiningNow.toFixed(6)} | rigs used: B${usedBasic}/P${usedPro}/L${usedLegend} | per-epoch ${perEpochFromRigs.toFixed(2)} | left ${leftMMSS}`
      );
    }
  }, [now, active, liveMiningNow, pendingAmt, usedBasic, usedPro, usedLegend, baseUnitPerEpoch, leftMMSS, lastBeatTs]);

  /* ======================
     UI
     ====================== */
  return (
    <div className="fin-wrap">
      {/* Head */}
      <div className="fin-page-head">
        <h1>Mining Console</h1>
        <p>Real-time on-chain monitoring</p>
      </div>

      {/* Console card */}
      <section className="fin-card fin-card-pad" aria-label="Console">
        <div className="fin-row">
          <div className="fin-epoch">
            <small>Epoch</small>
            <strong>{typeof eNowBn !== "undefined" ? String(eNowBn) : "—"}</strong>
          </div>
          <span
            className={
              prelaunch && goLiveOn
                ? "fin-badge fin-badge-pre"
                : active
                ? "fin-badge fin-badge-active"
                : "fin-badge fin-badge-paused"
            }
          >
            {prelaunch && goLiveOn ? "Prelaunch" : active ? "Active" : "Paused"}
          </span>
        </div>

        <div className="fin-progress">
          <div className="fin-progress-head">
            <span>Epoch progress</span>
            <span>Next in <b>{leftMMSS}</b></span>
          </div>
          <div className="fin-bar"><i style={{ width: `${epochProgress.pct}%` }} /></div>
        </div>

        {/* Realtime $BaseTC meter */}
        <div className="fin-actions">
          <div className="fin-cooldown">
            <span className="opacity-80">Mining now:</span>{" "}
            <b>
              {liveMiningNow.toLocaleString("en-US", { minimumFractionDigits: 6, maximumFractionDigits: 6 })} $BaseTC
            </b>
          </div>

          {active ? (
            <button
              onClick={onClaim}
              disabled={!address || busy || !canClaim}
              className={`fin-btn fin-btn-claim transition-transform active:scale-[0.98] ${(!address || busy || !canClaim) ? "opacity-50 cursor-not-allowed" : ""}`}
              title={canClaim ? "Claim rewards" : "No rewards available yet"}
            >
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-transparent animate-spin" />
                  Claiming…
                </span>
              ) : ("Claim")}
            </button>
          ) : (
            <button
              onClick={onStart}
              disabled={!address || busy || !canToggle || (prelaunch && goLiveOn)}
              className={`fin-btn fin-btn-start transition-transform active:scale-[0.98] ${(!address || busy || !canToggle || (prelaunch && goLiveOn)) ? "opacity-50 cursor-not-allowed" : ""}`}
              title={!address ? "Connect wallet" : "Start mining"}
            >
              {busy ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-transparent animate-spin" />
                  Starting…
                </span>
              ) : ("Start Mining")}
            </button>
          )}
        </div>

        {/* Status */}
        {statusText && <div className="fin-msg whitespace-pre-line">{statusText}</div>}
      </section>

      {/* Terminal */}
      <section className="fin-terminal" ref={terminalRef} aria-label="Terminal">
        <p>&gt; Terminal ready...</p>
        {terminalLogs.map((log, i) => (
          <p key={i}>&gt; {log}</p>
        ))}
      </section>

      {/* Stats */}
      <section className="fin-stats border-none shadow-none bg-transparent">
        <div className="fin-stat">
          <div className="fin-val">{formatNumber(effectiveHashrate)}</div>
          <div className="fin-cap">Effective Hashrate</div>
        </div>
        <div className="fin-stat">
          <div className="fin-tooltip">
            <div className="fin-val">
              {baseUnitPerEpoch.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="fin-tip">
              Exact: {baseUnitPerEpoch.toLocaleString("en-US", { minimumFractionDigits: 12 })}
            </div>
          </div>
          <div className="fin-cap">Base Unit / Epoch</div>
        </div>
        <div className="fin-stat">
          <div className="fin-tooltip">
            <div className="fin-val">{tokenShort}</div>
            <div className="fin-tip">Exact: {tokenExact}</div>
          </div>
          <div className="fin-cap">$BaseTC</div>
        </div>
      </section>

      {/* Rigs */}
      <section className="fin-card fin-rigs border-0 shadow-none bg-neutral-800/60">
        <div className="fin-rig-head">
          <h2>Your Rigs</h2>
        </div>

        <div className="fin-rig-grid">
          <RigBox tier="Basic"  count={String(countBasic)}  owned={countBasic > 0n}  badge={address ? `${Number(usedBasic)} used, ${Number(idleBasic)} idle` : undefined}  placeholder="/img/basic.png" />
          <RigBox tier="Pro"    count={String(countPro)}    owned={countPro > 0n}    badge={address ? `${Number(usedPro)} used, ${Number(idlePro)} idle` : undefined}    placeholder="/img/pro.png" />
          <RigBox tier="Legend" count={String(countLegend)} owned={countLegend > 0n} badge={address ? `${Number(usedLegend)} used, ${Number(idleLegend)} idle` : undefined} placeholder="/img/legend.png" />
        </div>
      </section>

      <div className="fin-bottom-space" />

      {/* Overlays */}
      <LoadingOverlay show={loading || busy} label={statusText || "Processing…"} />
      <CenterPopup open={popupOpen} message={popupMsg} onOK={() => setPopupOpen(false)} />
    </div>
  );
};

export default Monitoring;

/* ---------- Subcomponent: RigBox ---------- */
function RigBox({
  tier,
  count,
  owned,
  badge,
  placeholder,
}: {
  tier: string;
  count: string;
  owned: boolean;
  badge?: string;
  placeholder: string;
}) {
  const [imgErr, setImgErr] = useState(false);

  return (
    <div className="fin-rig">
      <div className={`fin-rig-img ${!owned ? "fin-blur" : ""}`}>
        {!imgErr ? (
          <Image
            src={placeholder}
            alt={`${tier} Rig`}
            fill
            sizes="(max-width: 420px) 33vw, 140px"
            style={{ objectFit: "contain" }}
            onError={() => setImgErr(true)}
          />
        ) : (
          <span>{tier} PNG</span>
        )}
      </div>
      <div className="fin-tier">{tier}</div>
      <div className="fin-count">x{count}</div>
      {badge ? <div className="fin-badge-mini">{badge}</div> : null}
    </div>
  );
}
