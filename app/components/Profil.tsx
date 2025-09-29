"use client";

import { useEffect, useMemo, useState } from "react";
import type { FC } from "react";
import Image from "next/image";
import {
  useAccount,
  useReadContract,
} from "wagmi";
import {
  baseTcAddress,
  baseTcABI,
  rigNftAddress,
  rigNftABI,
  gameCoreAddress,
  gameCoreABI,
  chainId as BASE_CHAIN_ID,
  rigSaleAddress,
  rigSaleABI,
} from "../lib/web3Config";

type Achievement = { name: string; icon: string };
type LbRow = {
  fid?: number | null;
  username?: string | null;
  display_name?: string | null;
  score?: number | null;
  rewards?: number | null;
  total_rewards?: number | null;
  hashrate?: number | null;
  rank?: number | null;
};

type InvitedUser = {
  fid: number | null;
  wallet?: string | null;
  username?: string | null;
  display_name?: string | null;
  pfp_url?: string | null;
  status?: "valid" | "pending";
};

const Icon: FC<{ path: string; className?: string }> = ({ path, className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d={path} />
  </svg>
);

const StatCard: FC<{ title: string; value: string }> = ({ title, value }) => (
  <div className="flex-1 bg-neutral-800 rounded-lg p-3 text-center text-xs md:text-sm">
    <div className="text-lg font-semibold">{value}</div>
    <div className="text-neutral-400">{title}</div>
  </div>
);

async function getFarcasterProfile(): Promise<{ fid: number | null; username: string | null; displayName: string | null; pfpUrl: string | null; }> {
  try {
    const mod = await import("@farcaster/miniapp-sdk");
    const rawCtx: any = (mod as any)?.sdk?.context;
    let ctx: any = null;
    if (typeof rawCtx === "function") ctx = await rawCtx.call((mod as any).sdk);
    else if (rawCtx && typeof rawCtx.then === "function") ctx = await rawCtx;
    else ctx = rawCtx ?? null;
    const user = ctx?.user ?? {};
    return { fid: user?.fid ?? null, username: user?.username ?? null, displayName: user?.displayName ?? null, pfpUrl: user?.pfpUrl ?? null };
  } catch { return { fid: null, username: null, displayName: null, pfpUrl: null }; }
}

function getAndStoreRefFromUrl(): number | null {
  try {
    const urlRefParam = new URL(window.location.href).searchParams.get("ref");
    const urlRef = urlRefParam ? Number(urlRefParam) : NaN;
    const stored = Number(localStorage.getItem("basetc_ref") || "0");
    const ref = [urlRef, stored].find((v) => !!v && !Number.isNaN(v)) ?? null;
    if (ref) localStorage.setItem("basetc_ref", String(ref));
    return (ref as number) ?? null;
  } catch { return null; }
}

async function fetchLeaderboard(): Promise<LbRow[]> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return [];
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await supabase.from("leaderboard").select("*").order("score", { ascending: false }).limit(10);
    if (error) console.warn("[leaderboard] supabase error:", error.message);
    return (data as LbRow[]) || [];
  } catch (e) { console.warn("[leaderboard] load failed:", e); return []; }
}

export default function Profil() {
  const { address } = useAccount();

  // ===== Farcaster profile (langsung dari Mini App SDK)
  const [fc, setFc] = useState<{ fid: number | null; username: string | null; displayName: string | null; pfpUrl: string | null; }>({ fid: null, username: null, displayName: null, pfpUrl: null });
  const [copied, setCopied] = useState(false);
  const [refFid, setRefFid] = useState<number | null>(null);
  const [lb, setLb] = useState<LbRow[]>([]);
  const [lbLoading, setLbLoading] = useState<boolean>(true);

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

  // ====== On-chain reads untuk achievements (tidak diubah)
  const basicId = useReadContract({ address: rigNftAddress as `0x${string}`, abi: rigNftABI as any, functionName: "BASIC" });
  const proId   = useReadContract({ address: rigNftAddress as `0x${string}`, abi: rigNftABI as any, functionName: "PRO" });
  const legId   = useReadContract({ address: rigNftAddress as `0x${string}`, abi: rigNftABI as any, functionName: "LEGEND" });

  const BASIC  = basicId.data as bigint | undefined;
  const PRO    = proId.data as bigint | undefined;
  const LEGEND = legId.data as bigint | undefined;

  const basicBal = useReadContract({ address: rigNftAddress as `0x${string}`, abi: rigNftABI as any, functionName: "balanceOf",
    args: address && BASIC  !== undefined ? [address, BASIC]   : undefined, query: { enabled: Boolean(address && BASIC  !== undefined) }});
  const proBal   = useReadContract({ address: rigNftAddress as `0x${string}`, abi: rigNftABI as any, functionName: "balanceOf",
    args: address && PRO    !== undefined ? [address, PRO]     : undefined, query: { enabled: Boolean(address && PRO    !== undefined) }});
  const legendBal= useReadContract({ address: rigNftAddress as `0x${string}`, abi: rigNftABI as any, functionName: "balanceOf",
    args: address && LEGEND !== undefined ? [address, LEGEND]  : undefined, query: { enabled: Boolean(address && LEGEND !== undefined) }});

  const countBasic  = (basicBal.data as bigint | undefined)  ?? 0n;
  const countPro    = (proBal.data as bigint | undefined)    ?? 0n;
  const countLegend = (legendBal.data as bigint | undefined) ?? 0n;

  const baseBal = useReadContract({ address: baseTcAddress as `0x${string}`, abi: baseTcABI as any, functionName: "balanceOf",
    args: address ? [address] : undefined, query: { enabled: Boolean(address) }});
  const baseReadable = useMemo(() => { const v = baseBal.data as bigint | undefined; return v ? (Number(v) / 1e18).toFixed(3) : "0.000"; }, [baseBal.data]);

  const isSupreme = useReadContract({ address: gameCoreAddress as `0x${string}`, abi: gameCoreABI as any, functionName: "isSupreme",
    args: address ? [address] : undefined, query: { enabled: Boolean(address) }});

  const achievements: Achievement[] = [
    ...(countBasic  > 0n ? [{ name: "Early Miner",  icon: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" }] : []),
    ...(countPro    > 0n ? [{ name: "Pro Upgrader", icon: "M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-3.75-2.25M21 18l-3.75-2.25" }] : []),
    ...(countLegend > 0n ? [{ name: "First Legend", icon: "M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.362-3.797z" }] : []),
    ...((isSupreme.data as boolean | undefined) ? [{ name: "Supreme", icon: "M10.5 6a7.5 7.5 0 100 15 7.5 7.5 0 000-15zM2.25 9h19.5" }] : []),
  ];

  // ===== Invite: total valid dari on-chain + daftar dari backend (Supabase) jika tersedia
  const inviteCountRes = useReadContract({
    address: rigSaleAddress as `0x${string}`,
    abi: rigSaleABI as any,
    functionName: "inviteCountOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });
  const totalInvitesValid = inviteCountRes?.data ? Number(inviteCountRes.data as bigint) : 0;

  const [invites, setInvites] = useState<InvitedUser[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);

  useEffect(() => {
    if (!address) return;
    (async () => {
      setLoadingInvites(true);
      try {
        // Prefer backend detail if available
        const r = await fetch(`/api/referral?inviter=${address}&detail=1`);
        const j = await r.json().catch(() => ({}));
        if (j?.invited && Array.isArray(j.invited)) {
          setInvites(
            j.invited.map((u: any): InvitedUser => ({
              fid: u?.fid ?? null,
              wallet: u?.wallet ?? null,
              username: u?.username ?? null,
              display_name: u?.display_name ?? null,
              pfp_url: u?.pfp_url ?? null,
              status: u?.status === "valid" ? "valid" : "pending",
            }))
          );
        } else {
          setInvites([]); // fallback empty
        }
      } catch {
        setInvites([]);
      } finally {
        setLoadingInvites(false);
      }
    })();
  }, [address]);

  // ===== UI helpers
  const shortAddr = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "—";
  const displayName = fc.displayName || fc.username || (fc.fid ? `fid:${fc.fid}` : "Guest");

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1000); } catch {}
  };

  const inviteLink = useMemo(() => {
    if (typeof window === "undefined") return "";
    const base = window.location.origin || "";
    const fid = fc.fid ?? "";
    if (!fid || !address) return `${base}/market`;
    return `${base}/market?fid=${fid}&ref=${address}`;
  }, [fc.fid, address]);

  const prettyReward = (row: LbRow) => {
    const v = row.score ?? row.total_rewards ?? row.rewards ?? null;
    if (v === null || typeof v !== "number") return "-";
    return `${v.toFixed(3)} $BaseTC`;
  };

  return (
    <div className="space-y-4 px-4 pt-4 pb-8">
      {/* ===== Profile header: ambil data dari Farcaster */}
      <div className="flex items-center justify-between bg-neutral-800 rounded-lg p-3">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-neutral-700 rounded-full overflow-hidden flex items-center justify-center">
            {fc.pfpUrl ? <Image src={fc.pfpUrl} alt="pfp" width={48} height={48} /> : <span className="text-xs text-neutral-400">PFP</span>}
          </div>
          <div>
            <div className="font-semibold text-sm md:text-base">
              {displayName}
              {fc.username && <span className="text-xs text-neutral-400 ml-2">@{fc.username}</span>}
            </div>
            <div className="text-[11px] text-neutral-400">
              {fc.fid ? <>FID: <b>{fc.fid}</b></> : "Not in Farcaster Mini App context"}
            </div>
            {address && (
              <div className="text-xs md:text-sm text-neutral-400 flex items-center space-x-2">
                <span>{shortAddr}</span>
                <button onClick={() => copy(address)} className="px-2 py-0.5 rounded-md bg-neutral-700 hover:bg-neutral-600 text-[10px]" title="Copy address">
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            )}
            {!!refFid && (
              <div className="mt-1 inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-neutral-700 text-[10px]">
                <span className="opacity-70">Referred By</span>
                <span className="font-medium">{`fid:${refFid}`}</span>
              </div>
            )}
          </div>
        </div>
        {(isSupreme.data as boolean | undefined) && (
          <div className="px-2 py-1 rounded-md text-[10px] bg-purple-700/30 border border-purple-600/40">Supreme</div>
        )}
      </div>

      {/* ===== Statistics diganti: total invite + copy link + daftar undangan */}
      <div className="bg-neutral-800 rounded-lg p-3 space-y-3">
        <h2 className="font-semibold text-sm md:text-base">Invites</h2>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <div className="flex gap-2 w-full">
            <div className="flex-1">
              <div className="text-[11px] text-neutral-400">Total Invited (valid)</div>
              <div className="text-lg font-semibold">{totalInvitesValid}</div>
            </div>
            <div className="flex-1">
              <div className="text-[11px] text-neutral-400">Your $BaseTC</div>
              <div className="text-lg font-semibold">{baseReadable}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              readOnly
              value={inviteLink}
              className="bg-neutral-900 border border-neutral-700 rounded-md px-2 py-1 text-xs w-[260px]"
            />
            <button
              disabled={!inviteLink}
              onClick={() => inviteLink && copy(inviteLink)}
              className="px-3 py-1.5 text-xs rounded-md bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50"
            >
              {copied ? "Copied!" : "Copy Link"}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-xs text-neutral-400">Invited Users</div>
          <div className="overflow-hidden rounded-md border border-neutral-700">
            <table className="w-full text-xs">
              <thead className="bg-neutral-900 text-neutral-400">
                <tr>
                  <th className="text-left px-2 py-1.5">User</th>
                  <th className="text-left px-2 py-1.5">FID</th>
                  <th className="text-left px-2 py-1.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {loadingInvites ? (
                  <tr><td className="px-2 py-2 text-neutral-500" colSpan={3}>Loading…</td></tr>
                ) : invites.length === 0 ? (
                  <tr><td className="px-2 py-2 text-neutral-500" colSpan={3}>
                    Belum ada data undangan. (Jika kamu sudah menghubungkan Supabase & endpoint <code>/api/referral?detail=1</code>, daftar akan muncul di sini.)
                  </td></tr>
                ) : (
                  invites.map((u, i) => (
                    <tr key={`${u.fid ?? "x"}-${i}`} className="border-t border-neutral-700">
                      <td className="px-2 py-1.5 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full overflow-hidden bg-neutral-700 flex items-center justify-center">
                          {u.pfp_url ? <Image src={u.pfp_url} alt="" width={24} height={24} /> : <span className="text-[10px] text-neutral-400">P</span>}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium">{u.display_name || u.username || (u.wallet ? `${u.wallet.slice(0,6)}…${u.wallet.slice(-4)}` : "—")}</span>
                          {u.username && <span className="text-[10px] text-neutral-400">@{u.username}</span>}
                        </div>
                      </td>
                      <td className="px-2 py-1.5">{u.fid ?? "—"}</td>
                      <td className="px-2 py-1.5">
                        {u.status === "valid" ? (
                          <span className="px-2 py-0.5 rounded bg-green-500/20 text-green-300 text-[10px]">valid</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-300 text-[10px]">pending</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-neutral-500">
            *Total “valid” di atas berasal dari on-chain <code>inviteCountOf</code>. Daftar detail “pending/valid” berasal dari backend (Supabase), jika tersedia.
          </p>
        </div>
      </div>

      {/* ===== Achievements (tidak diubah) */}
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

      {/* ===== Leaderboard (tidak diubah) */}
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
                    <td className="px-2 py-1.5">{row.display_name || row.username || (row.fid ? `fid:${row.fid}` : "—")}</td>
                    <td className="px-2 py-1.5 text-right">{prettyReward(row)}</td>
                    <td className="px-2 py-1.5 text-right">{typeof row.hashrate === "number" ? `${row.hashrate}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[10px] text-neutral-500">
          *Leaderboard membaca tabel <code>leaderboard</code> di Supabase. Sesuaikan kolom sesuai backend (score/total_rewards/rewards/hashrate/rank).
        </p>
      </div>

      {/* ===== "Your Rigs" DIHAPUS sesuai permintaan */}
    </div>
  );
}

