"use client";

import { useEffect, useMemo, useState } from "react";
import type { FC } from "react";
import Image from "next/image";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import {
  baseTcAddress,
  baseTcABI,
  rigNftAddress,
  rigNftABI,
  gameCoreAddress,
  gameCoreABI,
} from "../lib/web3Config";

type Achievement = { name: string; icon: string };
type LbRow = {
  fid?: number | null;
  username?: string | null;
  display_name?: string | null;
  score?: number | null;        // fleksibel: pakai score bila ada
  rewards?: number | null;      // atau rewards
  total_rewards?: number | null;// atau total_rewards
  hashrate?: number | null;
  rank?: number | null;
};

const Icon: FC<{ path: string; className?: string }> = ({ path, className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
       stroke="currentColor" strokeWidth={1.5} className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

const StatCard: FC<{ title: string; value: string }> = ({ title, value }) => (
  <div className="flex-1 bg-neutral-800 rounded-lg p-3 text-center text-xs md:text-sm">
    <div className="text-lg font-semibold">{value}</div>
    <div className="text-neutral-400">{title}</div>
  </div>
);

// ---- Farcaster helpers (dinamis agar aman di SSR) ----
async function getFarcasterProfile(): Promise<{
  fid: number | null;
  username: string | null;
  displayName: string | null;
  pfpUrl: string | null;
}> {
  try {
    const mod = await import("@farcaster/miniapp-sdk");
    const rawCtx: any = (mod as any)?.sdk?.context;
    let ctx: any = null;
    if (typeof rawCtx === "function") ctx = await rawCtx.call((mod as any).sdk);
    else if (rawCtx && typeof rawCtx.then === "function") ctx = await rawCtx;
    else ctx = rawCtx ?? null;

    const user = ctx?.user ?? {};
    return {
      fid: user?.fid ?? null,
      username: user?.username ?? null,
      displayName: user?.displayName ?? null,
      pfpUrl: user?.pfpUrl ?? null,
    };
  } catch {
    return { fid: null, username: null, displayName: null, pfpUrl: null };
  }
}

// ---- Referral helpers ----
function getAndStoreRefFromUrl(): number | null {
  try {
    const urlRefParam = new URL(window.location.href).searchParams.get("ref");
    const urlRef = urlRefParam ? Number(urlRefParam) : NaN;
    const stored = Number(localStorage.getItem("basetc_ref") || "0");
    const ref = [urlRef, stored].find((v) => !!v && !Number.isNaN(v)) ?? null;
    if (ref) localStorage.setItem("basetc_ref", String(ref));
    return (ref as number) ?? null;
  } catch {
    return null;
  }
}

// ---- Supabase leaderboard (dinamis) ----
async function fetchLeaderboard(): Promise<LbRow[]> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return [];
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(url, key, { auth: { persistSession: false } });

    // Skema fleksibel: coba ambil semua kolom, urutkan by 'score' desc; fallback di UI
    const { data, error } = await supabase
      .from("leaderboard")
      .select("*")
      .order("score", { ascending: false })
      .limit(10);
    if (error) console.warn("[leaderboard] supabase error:", error.message);
    return (data as LbRow[]) || [];
  } catch (e) {
    console.warn("[leaderboard] load failed:", e);
    return [];
  }
}

export default function Profil() {
  const { address } = useAccount();
  const [fc, setFc] = useState<{ fid: number | null; username: string | null; displayName: string | null; pfpUrl: string | null; }>({ fid: null, username: null, displayName: null, pfpUrl: null });
  const [msg, setMsg] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [refFid, setRefFid] = useState<number | null>(null);
  const [lb, setLb] = useState<LbRow[]>([]);
  const [lbLoading, setLbLoading] = useState<boolean>(true);

  // Init Farcaster + Referral + Leaderboard
  useEffect(() => {
    (async () => {
      setFc(await getFarcasterProfile());
      const r = getAndStoreRefFromUrl();
      setRefFid(r);
      setLbLoading(true);
      const rows = await fetchLeaderboard();
      setLb(rows);
      setLbLoading(false);
    })();
  }, []);

  // ---- Ambil ID tier dari RigNFT ----
  const basicId = useReadContract({ address: rigNftAddress as `0x${string}`, abi: rigNftABI as any, functionName: "BASIC" });
  const proId   = useReadContract({ address: rigNftAddress as `0x${string}`, abi: rigNftABI as any, functionName: "PRO" });
  const legId   = useReadContract({ address: rigNftAddress as `0x${string}`, abi: rigNftABI as any, functionName: "LEGEND" });

  const BASIC  = basicId.data as bigint | undefined;
  const PRO    = proId.data as bigint | undefined;
  const LEGEND = legId.data as bigint | undefined;

  // ---- Balances NFT user ----
  const basicBal = useReadContract({
    address: rigNftAddress as `0x${string}`, abi: rigNftABI as any, functionName: "balanceOf",
    args: address && BASIC !== undefined ? [address, BASIC] : undefined,
    query: { enabled: Boolean(address && BASIC !== undefined) },
  });
  const proBal = useReadContract({
    address: rigNftAddress as `0x${string}`, abi: rigNftABI as any, functionName: "balanceOf",
    args: address && PRO !== undefined ? [address, PRO] : undefined,
    query: { enabled: Boolean(address && PRO !== undefined) },
  });
  const legendBal = useReadContract({
    address: rigNftAddress as `0x${string}`, abi: rigNftABI as any, functionName: "balanceOf",
    args: address && LEGEND !== undefined ? [address, LEGEND] : undefined,
    query: { enabled: Boolean(address && LEGEND !== undefined) },
  });

  const countBasic  = (basicBal.data as bigint | undefined) ?? 0n;
  const countPro    = (proBal.data as bigint | undefined) ?? 0n;
  const countLegend = (legendBal.data as bigint | undefined) ?? 0n;

  // ---- Token $BASETC ----
  const baseBal = useReadContract({
    address: baseTcAddress as `0x${string}`, abi: baseTcABI as any, functionName: "balanceOf",
    args: address ? [address] : undefined, query: { enabled: Boolean(address) },
  });
  const baseReadable = useMemo(() => {
    const v = baseBal.data as bigint | undefined;
    return v ? (Number(v) / 1e18).toFixed(3) : "0.000";
  }, [baseBal.data]);

  // ---- GameCore stats ----
  const epochNow = useReadContract({
    address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: "epochNow",
  });

  const preview = useReadContract({
    address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: "preview",
    args:
      address &&
      typeof epochNow.data !== "undefined" &&
      (epochNow.data as bigint) > 0n
        ? [(epochNow.data as bigint) - 1n, address]
        : undefined,
    query: {
      enabled: Boolean(
        address &&
        typeof epochNow.data !== "undefined" &&
        (epochNow.data as bigint) > 0n
      ),
    },
  });

  const hashrate = useReadContract({
    address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: "getHashrate",
    args: address ? [address] : undefined, query: { enabled: Boolean(address) },
  });
  const baseUnit = useReadContract({
    address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: "getBaseUnit",
    args: address ? [address] : undefined, query: { enabled: Boolean(address) },
  });
  const isSupreme = useReadContract({
    address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: "isSupreme",
    args: address ? [address] : undefined, query: { enabled: Boolean(address) },
  });

  const hashrateNum = useMemo(() => {
    const v = hashrate.data as bigint | undefined;
    return v ? Number(v) : 0;
  }, [hashrate.data]);
  const baseUnitNum = useMemo(() => {
    const v = baseUnit.data as bigint | undefined;
    return v ? Number(v) : 0;
  }, [baseUnit.data]);
  const previewReadable = useMemo(() => {
    const v = preview.data as bigint | undefined;
    return v ? (Number(v) / 1e18).toFixed(3) : "0.000";
  }, [preview.data]);

  // ---- Claim epoch-1 ----
  const { writeContract, data: claimHash, isPending: claimPending, error: claimErr } = useWriteContract();
  const { isLoading: claimWaiting, isSuccess: claimOk } = useWaitForTransactionReceipt({ hash: claimHash });

  useEffect(() => {
    if (claimOk) setMsg("Claim success!");
    if (claimErr) {
      const e: any = claimErr;
      setMsg(e?.shortMessage || e?.message || "Claim failed");
    }
  }, [claimOk, claimErr]);

  const canClaim = useMemo(() => {
    const e = epochNow.data as bigint | undefined;
    return Boolean(address && typeof e !== "undefined" && e > 0n && Number(previewReadable) > 0);
  }, [address, epochNow.data, previewReadable]);

  const onClaim = () => {
    if (!address) return setMsg("Connect wallet first.");
    const e = epochNow.data as bigint | undefined;
    if (!e || e === 0n) return;
    writeContract({
      address: gameCoreAddress as `0x${string}`,
      abi: gameCoreABI as any,
      functionName: "claim",
      args: [e - 1n, address],
    });
    setMsg("Claiming reward…");
  };

  // ---- Achievements sederhana ----
  const achievements: Achievement[] = [
    ...(countBasic > 0n ? [{ name: "Early Miner", icon: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" }] : []),
    ...(countPro > 0n ? [{ name: "Pro Upgrader", icon: "M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-3.75-2.25M21 18l-3.75-2.25" }] : []),
    ...(countLegend > 0n ? [{ name: "First Legend", icon: "M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.362-3.797z" }] : []),
    ...((isSupreme.data as boolean | undefined) ? [{ name: "Supreme", icon: "M10.5 6a7.5 7.5 0 100 15 7.5 7.5 0 000-15zM2.25 9h19.5" }] : []),
  ];

  const rigsOwned = Number(countBasic + countPro + countLegend);
  const shortAddr = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "—";
  const displayName = fc.displayName || fc.username || (fc.fid ? `fid:${fc.fid}` : "Guest");

  // ---- Copy address ----
  const copyAddr = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  // ---- Leaderboard helpers ----
  const prettyReward = (row: LbRow) => {
    const v = row.score ?? row.total_rewards ?? row.rewards ?? null;
    if (v === null || typeof v !== "number") return "-";
    return `${v.toFixed(3)} $BaseTC`;
    // kalau skor bukan reward, tinggal ganti label sesuai backend
  };

  return (
    <div className="space-y-4 px-4 pt-4 pb-8">
      {/* User Info Panel */}
      <div className="flex items-center justify-between bg-neutral-800 rounded-lg p-3">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-neutral-700 rounded-full overflow-hidden flex items-center justify-center">
            {fc.pfpUrl ? (
              <Image src={fc.pfpUrl} alt="pfp" width={48} height={48} />
            ) : (
              <span className="text-xs text-neutral-400">PFP</span>
            )}
          </div>
          <div>
            <div className="font-semibold text-sm md:text-base">{displayName}</div>
            <div className="text-xs md:text-sm text-neutral-400 flex items-center space-x-2">
              <span>{shortAddr}</span>
              {address && (
                <button
                  onClick={copyAddr}
                  className="px-2 py-0.5 rounded-md bg-neutral-700 hover:bg-neutral-600 text-[10px]"
                  title="Copy address"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              )}
            </div>
            {!!refFid && (
              <div className="mt-1 inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-neutral-700 text-[10px]">
                <span className="opacity-70">Referred By</span>
                <span className="font-medium">{`fid:${refFid}`}</span>
              </div>
            )}
          </div>
        </div>
        {/* optional badge supreme */}
        {(isSupreme.data as boolean | undefined) && (
          <div className="px-2 py-1 rounded-md text-[10px] bg-purple-700/30 border border-purple-600/40">
            Supreme
          </div>
        )}
      </div>

      {/* Stats Panel */}
      <div className="bg-neutral-800 rounded-lg p-3 space-y-3">
        <h2 className="font-semibold text-sm md:text-base">Statistics</h2>
        <div className="flex space-x-2">
          <StatCard title="Rigs Owned" value={String(rigsOwned)} />
          <StatCard title="Hashrate (on-chain)" value={String(hashrateNum)} />
          <StatCard title="Base Unit" value={String(baseUnitNum)} />
        </div>
        <div className="flex space-x-2">
          <StatCard title="Token Balance" value={`${baseReadable} $BaseTC`} />
          <StatCard title="Preview (epoch-1)" value={`${previewReadable} $BaseTC`} />
          <StatCard title="Epoch Now" value={typeof epochNow.data !== "undefined" ? String(epochNow.data) : "-"} />
        </div>
        <div className="pt-1">
          <button
            onClick={onClaim}
            disabled={!canClaim || claimPending || claimWaiting}
            className="px-3 py-1.5 text-xs rounded-md bg-neutral-700 hover:bg-neutral-600 disabled:bg-neutral-700 disabled:text-neutral-500"
            title={!canClaim ? "No claimable reward yet" : undefined}
          >
            {claimPending || claimWaiting ? "Claiming…" : "Claim epoch-1"}
          </button>
          {!!msg && <span className="ml-2 text-xs text-green-400">{msg}</span>}
        </div>
      </div>

      {/* Achievements Panel */}
      <div className="bg-neutral-800 rounded-lg p-3 space-y-2">
        <h2 className="font-semibold text-sm md:text-base">Achievements</h2>
        {achievements.length === 0 ? (
          <div className="text-xs text-neutral-500">No achievements yet…</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {achievements.map((ach) => (
              <div key={ach.name} className="flex items-center space-x-1 bg-neutral-800 rounded-md px-2 py-1 text-xs">
                <Icon path={ach.icon} className="w-4 h-4 text-yellow-400" />
                <span>{ach.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Leaderboard Panel */}
      <div className="bg-neutral-800 rounded-lg p-3 space-y-2">
        <h2 className="font-semibold text-sm md:text-base">Leaderboard</h2>
        {lbLoading ? (
          <div className="text-xs text-neutral-500">Loading…</div>
        ) : lb.length === 0 ? (
          <div className="text-xs text-neutral-500">No data yet…</div>
        ) : (
          <div className="overflow-hidden rounded-md border border-neutral-700">
            <table className="w-full text-xs">
              <thead className="bg-neutral-900 text-neutral-400">
                <tr>
                  <th className="text-left px-2 py-1.5">#</th>
                  <th className="text-left px-2 py-1.5">User</th>
                  <th className="text-right px-2 py-1.5">Reward/Score</th>
                  <th className="text-right px-2 py-1.5">Hashrate</th>
                </tr>
              </thead>
              <tbody>
                {lb.map((row, i) => (
                  <tr key={`${row.fid ?? "x"}-${i}`} className="border-t border-neutral-700">
                    <td className="px-2 py-1.5">{row.rank ?? i + 1}</td>
                    <td className="px-2 py-1.5">
                      {row.display_name || row.username || (row.fid ? `fid:${row.fid}` : "—")}
                    </td>
                    <td className="px-2 py-1.5 text-right">{prettyReward(row)}</td>
                    <td className="px-2 py-1.5 text-right">
                      {typeof row.hashrate === "number" ? `${row.hashrate}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* Keterangan kecil */}
        <p className="text-[10px] text-neutral-500">
          *Leaderboard membaca tabel <code>leaderboard</code> di Supabase. Sesuaikan kolom sesuai backend (score/total_rewards/rewards/hashrate/rank).
        </p>
      </div>

      {/* Inventory ringkas */}
      <div className="bg-neutral-800 rounded-lg p-3 space-y-2">
        <h2 className="font-semibold text-sm md:text-base">Your Rigs</h2>
        <div className="grid grid-cols-3 gap-2 text-center text-xs md:text-sm">
          <div className="bg-neutral-900 rounded-lg p-2">
            <div className="text-neutral-400">Basic</div>
            <div className="text-lg font-semibold">x{String(countBasic)}</div>
          </div>
          <div className="bg-neutral-900 rounded-lg p-2">
            <div className="text-neutral-400">Pro</div>
            <div className="text-lg font-semibold">x{String(countPro)}</div>
          </div>
          <div className="bg-neutral-900 rounded-lg p-2">
            <div className="text-neutral-400">Legend</div>
            <div className="text-lg font-semibold">x{String(countLegend)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

