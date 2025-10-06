// app/utils/snapshot.ts
export type Entitlement = { amount: string; proof: `0x${string}`[] };
export type Snapshot = {
  snapshotId: number;
  merkleRoot: `0x${string}`;
  totalAmount: string;
  claimUntil: number;
  entries: Record<`0x${string}`, Entitlement>;
};

export async function fetchCurrentSnapshot(): Promise<Snapshot | null> {
  try {
    const idx = await fetch("/snapshots/index.json", { cache: "no-store" }).then(r => r.json());
    if (!idx?.url) return null;
    return fetch(idx.url, { cache: "no-store" }).then(r => r.json());
  } catch {
    return null;
  }
}

