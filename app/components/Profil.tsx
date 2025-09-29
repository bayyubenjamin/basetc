// app/components/Profil.tsx
//
// Alasan Perbaikan Final: Memperbaiki syntax error `||;` menjadi `|| []`
// dan `return;` menjadi `return []` di dalam fungsi `fetchLeaderboard`
// untuk memastikan fungsi selalu mengembalikan nilai array yang valid dan
// build berhasil.
"use client";

import { useEffect, useMemo, useState } from "react";
import type { FC } from "react";
import Image from "next/image";
import { useAccount, useReadContract } from "wagmi";
import {
  baseTcAddress,
  baseTcABI,
  rigNftAddress,
  rigNftABI,
  gameCoreAddress,
  gameCoreABI,
  rigSaleAddress,
  rigSaleABI,
} from "../lib/web3Config";
import { formatEther } from "viem";
import { useFarcaster } from "../context/FarcasterProvider";

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

async function fetchLeaderboard(): Promise<LbRow[]> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return [];
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await supabase.from("leaderboard").select("*").order("score", { ascending: false }).limit(10);
    if (error) console.warn("[leaderboard] supabase error:", error.message);
    // -- FIX DI SINI --
    return (data as LbRow[]) || [];
  } catch (e) {
    console.warn("[leaderboard] load failed:", e);
    // -- FIX DI SINI --
    return [];
  }
}

export default function Profil() {
  const { address } = useAccount();
  const { user: fcUser, loading: fcLoading } = useFarcaster();

  const [copied, setCopied] = useState(false);
  const [refAddr, setRefAddr] = useState<string | null>(null);
  const [lb, setLb] = useState<LbRow[]>([]);
  const [lbLoading, setLbLoading] = useState<boolean>(true);

  useEffect(() => {
    const r = localStorage.getItem("basetc_ref");
    if (r && /^0x[0-9a-fA-F]{40}$/.test(r)) {
      setRefAddr(r);
    }
    (async () => {
      setLbLoading(true);
      const rows = await fetchLeaderboard();
      setLb(rows);
      setLbLoading(false);
    })();
  }, []);

  const { data: BASIC } = useReadContract({ address: rigNftAddress, abi: rigNftABI as any, functionName: "BASIC" });
  const { data: PRO } = useReadContract({ address: rigNftAddress, abi: rigNftABI as any, functionName: "PRO" });
  const { data: LEGEND } = useReadContract({ address: rigNftAddress, abi: rigNftABI as any, functionName: "LEGEND" });
  const { data: countBasic = 0n } = useReadContract({ address: rigNftAddress, abi: rigNftABI as any, functionName: "balanceOf", args: address && BASIC ? [address, BASIC] : undefined, query: { enabled: !!(address && BASIC) }});
  const { data: countPro = 0n } = useReadContract({ address: rigNftAddress, abi: rigNftABI as any, functionName: "balanceOf", args: address && PRO ? [address, PRO] : undefined, query: { enabled: !!(address && PRO) }});
  const { data: countLegend = 0n } = useReadContract({ address: rigNftAddress, abi: rigNftABI as any, functionName: "balanceOf", args: address && LEGEND ? [address, LEGEND] : undefined, query: { enabled: !!(address && LEGEND) }});
  const { data: baseBal } = useReadContract({ address: baseTcAddress, abi: baseTcABI as any, functionName: "balanceOf", args: address ? [address] : undefined, query: { enabled: !!address }});
  const baseReadable = useMemo(() => baseBal ? formatEther(baseBal as bigint) : "0.000", [baseBal]);
  const { data: isSupreme } = useReadContract({ address: gameCoreAddress, abi: gameCoreABI as any, functionName: "isSupreme", args: address ? [address] : undefined, query: { enabled: !!address }});

  const achievements: Achievement[] = [
    ...((countBasic as bigint)  > 0n ? [{ name: "Early Miner",  icon: "M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" }] : []),
    ...((countPro as bigint)    > 0n ? [{ name: "Pro Upgrader", icon: "M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-3.75-2.25M21 18l-3.75-2.25" }] : []),
    ...((countLegend as bigint) > 0n ? [{ name: "First Legend", icon: "M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.362-3.797z" }] : []),
    ...(isSupreme ? [{ name: "Supreme", icon: "M10.5 6a7.5 7.5 0 100 15 7.5 7.5 0 000-15zM2.25 9h19.5" }] : []),
  ];

  const { data: totalInvitesValid = 0 } = useReadContract({
    address: rigSaleAddress, abi: rigSaleABI as any, functionName: "inviteCountOf",
    args: address ? [address] : undefined, query: { enabled: !!address, select: (d) => Number(d) },
  });

  const [invites, setInvites] = useState<InvitedUser[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);

  useEffect(() => {
    if (!address) return;
    (async () => {
      setLoadingInvites(true);
      try {
        const r = await fetch(`/api/referral?inviter=${address}&detail=1`);
        const j = await r.json();
        if (j?.list && Array.isArray(j.list)) {
          setInvites(j.list.map((u: any): InvitedUser => ({
            fid: u?.invitee_fid ?? null,
            wallet: u?.invitee_wallet ?? null,
            status: u?.status === "valid" ? "valid" : "pending",
          })));
        } else { setInvites([]); }
      } catch { setInvites([]);
      } finally { setLoadingInvites(false); }
    })();
  }, [address]);

  const shortAddr = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "—";
  const displayName = fcUser?.displayName || fcUser?.username || (fcUser?.fid ? `fid:${fcUser.fid}` : "Guest");
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1000); } catch {}
  };
  const inviteLink = useMemo(() => {
    if (typeof window === "undefined" || !address) return "";
    const base = window.location.origin || "";
    const refQuery = `ref=${address}`;
    const fidQuery = fcUser?.fid ? `&fid=${fcUser.fid}` : "";
    return `${base}?${refQuery}${fidQuery}`;
  }, [fcUser?.fid, address]);
  const prettyReward = (row: LbRow) => {
    const v = row.score ?? row.total_rewards ?? row.rewards ?? null;
    if (v === null || typeof v !== "number") return "-";
    return `${v.toFixed(3)} $BaseTC`;
  };

  return (
    <div className="space-y-4 px-4 pt-4 pb-8">
      <div className="flex items-center justify-between bg-neutral-800 rounded-lg p-3">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-neutral-700 rounded-full overflow-hidden flex items-center justify-center">
            {fcUser?.pfpUrl ? <Image src={fcUser.pfpUrl} alt="pfp" width={48} height={48} /> : <span className="text-xs text-neutral-400">PFP</span>}
          </div>
          <div>
            <div className="font-semibold text-sm md:text-base">
              {displayName}
              {fcUser?.username && <span className="text-xs text-neutral-400 ml-2">@{fcUser.username}</span>}
            </div>
            <div className="text-[11px] text-neutral-400">
              {fcLoading ? "Loading context..." : (fcUser?.fid ? <>FID: <b>{fcUser.fid}</b></> : "FID not available")}
            </div>
            {address && (
              <div className="text-xs md:text-sm text-neutral-400 flex items-center space-x-2">
                <span>{shortAddr}</span>
                <button onClick={() => copy(address)} className="px-2 py-0.5 rounded-md bg-neutral-700 hover:bg-neutral-600 text-[10px]" title="Copy address">
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            )}
             {!!refAddr && (
              <div className="mt-1 inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-neutral-700 text-[10px]">
                <span className="opacity-70">Referred By</span>
                <span className="font-medium">{`${refAddr.slice(0,6)}…`}</span>
              </div>
            )}
          </div>
        </div>
        {isSupreme && (
          <div className="px-2 py-1 rounded-md text-[10px] bg-purple-700/30 border border-purple-600/40">Supreme</div>
        )}
      </div>
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
                    <div className="text-lg font-semibold">{Number(baseReadable).toLocaleString()}</div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <input readOnly value={inviteLink} className="bg-neutral-900 border border-neutral-700 rounded-md px-2 py-1 text-xs w-full md:w-[260px]" />
                <button disabled={!inviteLink} onClick={() => inviteLink && copy(inviteLink)} className="px-3 py-1.5 text-xs rounded-md bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50">
                    {copied ? "Copied!" : "Copy Link"}
                </button>
            </div>
        </div>
        <div className="space-y-2">
          <div className="text-xs text-neutral-400">Invited Users (recent pending/valid)</div>
          <div className="overflow-hidden rounded-md border border-neutral-700">
            <table className="w-full text-xs">
              <thead className="bg-neutral-900 text-neutral-400">
                <tr>
                  <th className="text-left px-2 py-1.5">User (FID)</th>
                  <th className="text-left px-2 py-1.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {loadingInvites ? (
                  <tr><td className="px-2 py-2 text-neutral-500" colSpan={2}>Loading…</td></tr>
                ) : invites.length === 0 ? (
                  <tr><td className="px-2 py-2 text-neutral-500" colSpan={2}>
                    No recent invite data found.
                  </td></tr>
                ) : (
                  invites.slice(0, 5).map((u, i) => (
                    <tr key={`${u.fid ?? "x"}-${i}`} className="border-t border-neutral-700">
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
        </div>
      </div>
      <div className="bg-neutral-800 rounded-lg p-3 space-y-2">
        <h2 className="font-semibold text-sm md:text-base">Achievements</h2>
        {achievements.length === 0 ? (
          <div className="text-xs text-neutral-500">No achievements yet…</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {achievements.map((ach) => (
              <div key={ach.name} className="flex items-center space-x-1 bg-neutral-900 rounded-md px-2 py-1 text-xs">
                <Icon path={ach.icon} className="w-4 h-4 text-yellow-400" />
                <span>{ach.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
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
      </div>
    </div>
  );
}
