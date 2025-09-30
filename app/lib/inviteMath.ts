// app/api/referral/inviteMath.ts

/**
 * Aturan Free-Claim NFT Basic:
 * - 1 undangan pertama  → 1 NFT.
 * - Undangan #2..#11    → tiap 2 undangan = 1 NFT. (total 11 undangan = 6 NFT)
 * - Undangan #12+       → tiap 3 undangan = 1 NFT.
 */
export function calculateMaxClaims(validInvites: number): number {
  if (!Number.isFinite(validInvites) || validInvites <= 0) return 0;

  const first = validInvites >= 1 ? 1 : 0;
  const midInvites = Math.max(Math.min(validInvites, 11) - 1, 0); // invite #2..#11 → 0..10
  const mid = Math.floor(midInvites / 2);
  const tailInvites = Math.max(validInvites - 11, 0);             // invite #12+
  const tail = Math.floor(tailInvites / 3);

  return first + mid + tail;
}

/** Sisa kuota klaim = maksimal - yang sudah dipakai. */
export function remainingClaims(validInvites: number, usedClaims: number): number {
  const maxClaims = calculateMaxClaims(validInvites);
  const used = Number.isFinite(usedClaims) ? Math.max(0, usedClaims) : 0;
  return Math.max(0, maxClaims - used);
}

/** Breakdown buat UI (opsional). */
export function breakdownClaims(validInvites: number) {
  const first = validInvites >= 1 ? 1 : 0;
  const midInvites = Math.max(Math.min(validInvites, 11) - 1, 0);
  const mid = Math.floor(midInvites / 2);
  const tailInvites = Math.max(validInvites - 11, 0);
  const tail = Math.floor(tailInvites / 3);
  const total = first + mid + tail;
  return {
    total,
    firstBonus: first,
    twoPerOneRange: mid,
    threePerOneRange: tail,
  };
}

/** Berapa invite lagi ke klaim berikutnya (opsional). */
export function nextInvitesNeeded(validInvites: number): number {
  if (!Number.isFinite(validInvites) || validInvites < 0) return 1;

  if (validInvites < 1) return 1 - validInvites; // menuju bonus pertama

  if (validInvites < 11) {
    // periode 2-invite-1, dihitung sejak invite #2
    const usedInMid = validInvites - 1;  // 0..10
    const remainder = usedInMid % 2;     // 0 atau 1
    return remainder === 0 ? 2 : 1;
  }

  // periode 3-invite-1, mulai dari #12
  const usedInTail = validInvites - 11;  // 0..∞
  const remainder = usedInTail % 3;      // 0,1,2
  return remainder === 0 ? 3 : (3 - remainder);
}

