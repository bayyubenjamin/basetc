// Aturan: #1: 1 invite → +1; sampai total=10 → +1 tiap 2; >10 → +1 tiap 3
export function maxClaimsFrom(totalInvites: number): number {
  if (totalInvites <= 0) return 0;
  if (totalInvites <= 10) {
    return 1 + Math.floor(Math.max(0, totalInvites - 1) / 2);
  }
  return 5 + Math.floor((totalInvites - 10) / 3);
}

export function invitesNeededForNext(totalInvites: number, claimed: number): number {
  const nowMax = maxClaimsFrom(totalInvites);
  if (claimed < nowMax) return 0; // sudah boleh klaim
  let t = totalInvites;
  while (maxClaimsFrom(t) < claimed + 1) t++;
  return t - totalInvites;
}

