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

// ======================
// Utils & Constants
// ======================
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
  if (!resp.ok) throw new Error(json?.error || "bad_request from relayer");
  const { signature } = json || {};
  if (!signature) throw new Error("relayer: no signature");
  return { signature: signature as `0x${string}` };
}

const Monitoring: FC = () => {
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

  // ======================
  // GameCore Reads
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

  // Refs
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
    // Display convention: 1 / 5 / 25
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

  const busy = Boolean((writePending || receiptLoading) && lastAction !== null);

  useEffect(() => {
    if (isSuccess) {
      setMsg("Transaction confirmed.");
      addLog("Success: Transaction confirmed.");
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
  // Actions (WithSig)
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

      const nonce =
        (await (refetchNonce?.() || Promise.resolve({ data: userNonce.data })))?.data ??
        (userNonce.data as bigint | undefined) ??
        0n;

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
      const m = (e?.message || "").toLowerCase();
      const shouldRetry =
        m.includes("expired") ||
        m.includes("deadline") ||
        m.includes("bad_nonce") ||
        m.includes("bad nonce") ||
        m.includes("nonce");
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
      const em = e?.message || "Failed to claim";
      setMsg(em);
      addLog(`Error: ${em}`);
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
  }, [eNowBn, eLen, baseUnitPerEpoch, epochProgress.leftSec]);

  // ===== Cosmetic per-second stream =====
  useEffect(() => {
    if (!active || (prelaunch && goLiveOn)) return;
    if (epochBudget.sec <= 0 || epochBudget.amt <= 0) return;

    setEpochBudget((prev) => {
      if (prev.sec <= 0 || prev.amt <= 0) return prev;
      const baseline = prev.amt / prev.sec;
      const jitter = 0.85 + Math.random() * 0.3;
      let inc = baseline * jitter;
      if (inc > prev.amt) inc = prev.amt;
      const next = { amt: prev.amt - inc, sec: prev.sec - 1 };
      addLog(`+${inc.toFixed(6)} Base Unit (left: ${next.amt.toFixed(6)})`);
      return next;
    });
  }, [now, active, prelaunch, goLiveOn]);

  // =========== UI ===========
  return (
    <div className="fin-wrap">
      {/* Title only (bg gradient via .fin-wrap::before) */}
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
            <span>
              Next in <b>{leftMMSS}</b>
            </span>
          </div>
          <div className="fin-bar">
            <i style={{ width: `${epochProgress.pct}%` }} />
          </div>
        </div>

        <div className="fin-actions">
          <div className="fin-cooldown">
            Cooldown: <b>{String(cd ?? 0n)}</b> epoch
          </div>

          {active ? (
            <button
              onClick={onClaim}
              disabled={!address || busy || !canClaim}
              className="fin-btn fin-btn-claim"
              title={canClaim ? "Claim rewards" : "No rewards available yet"}
            >
              {busy && lastAction === "claim" ? "Claiming…" : "Claim"}
            </button>
          ) : (
            <button
              onClick={onStart}
              disabled={!address || busy || !canToggle || (prelaunch && goLiveOn)}
              className="fin-btn fin-btn-start"
            >
              {busy && lastAction === "start" ? "Starting…" : "Start Mining"}
            </button>
          )}
        </div>
        {!!msg && <div className="fin-msg">{msg}</div>}
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
              {baseUnitPerEpoch.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <div className="fin-tip">
              Exact:{" "}
              {baseUnitPerEpoch.toLocaleString("en-US", {
                minimumFractionDigits: 12,
              })}
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
          <div className="fin-rig-note">
            Basic x{String(countBasic)} • Pro x{String(countPro)} • Legend x{String(countLegend)}
          </div>
        </div>

        <div className="fin-rig-grid">
          <RigBox
            tier="Basic"
            count={String(countBasic)}
            owned={countBasic > 0n}
            badge={address ? `${usedBasic} used, ${idleBasic} idle` : undefined}
            placeholder="/img/basic.png"
          />
          <RigBox
            tier="Pro"
            count={String(countPro)}
            owned={countPro > 0n}
            badge={address ? `${usedPro} used, ${idlePro} idle` : undefined}
            placeholder="/img/pro.png"
          />
          <RigBox
            tier="Legend"
            count={String(countLegend)}
            owned={countLegend > 0n}
            badge={address ? `${usedLegend} used, ${idleLegend} idle` : undefined}
            placeholder="/img/legend.png"
          />
        </div>
      </section>

      <div className="fin-bottom-space" />
    </div>
  );
};

export default Monitoring;

/* ---------- Subcomponent: RigBox (render PNG + fallback teks) ---------- */
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
  placeholder: string; // e.g. "/img/basic.png"
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
