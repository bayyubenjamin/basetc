/**
 * Aturan Free-Claim NFT Basic berbasis undangan (validInvites):
 *
 * - 1 undangan pertama  → 1 NFT (bonus awal).
 * - Undangan #2 s/d #11 → setiap 2 undangan = 1 NFT.
 *   (Total di 11 undangan = 6 NFT: 1 (bonus) + floor(10/2) = 1 + 5 = 6)
 * - Undangan #12+       → setiap 3 undangan = 1 NFT.
 *
 * Catatan:
 * - Fungsi di file ini hanya menghitung HAK maksimal (quota) berdasar jumlah undangan valid.
 * - Untuk mencegah double-claim, kurangi dengan "usedClaims" (klaim yang sudah dipakai) di layer API.
 */

/** Mengembalikan total hak klaim maksimum berdasarkan total undangan valid. */
export function calculateMaxClaims(validInvites: number): number {
  if (!Number.isFinite(validInvites) || validInvites <= 0) return 0;

  // 1) Bonus undangan pertama = 1 NFT
  const first = validInvites >= 1 ? 1 : 0;

  // 2) Undangan #2..#11: setiap 2 undangan = 1 NFT
  const midInvites = Math.max(Math.min(validInvites, 11) - 1, 0); // rentang 0..10
  const mid = Math.floor(midInvites / 2);

  // 3) Undangan >=12: setiap 3 undangan = 1 NFT
  const tailInvites = Math.max(validInvites - 11, 0);
  const tail = Math.floor(tailInvites / 3);

  return first + mid + tail;
}

/** Mengembalikan sisa hak klaim (quota) setelah dikurangi klaim yang sudah dipakai. */
export function remainingClaims(validInvites: number, usedClaims: number): number {
  const maxClaims = calculateMaxClaims(validInvites);
  const used = Number.isFinite(usedClaims) ? Math.max(0, usedClaims) : 0;
  return Math.max(0, maxClaims - used);
}

/** Breakdown untuk kebutuhan UI/monitoring (opsional). */
export function breakdownClaims(validInvites: number) {
  const first = validInvites >= 1 ? 1 : 0;
  const midInvites = Math.max(Math.min(validInvites, 11) - 1, 0);
  const mid = Math.floor(midInvites / 2);
  const tailInvites = Math.max(validInvites - 11, 0);
  const tail = Math.floor(tailInvites / 3);
  const total = first + mid + tail;

  return {
    total,
    firstBonus: first,             // 1x jika >=1 undangan
    twoPerOneRange: mid,           // jumlah NFT dari periode 2-invite-1 (invite #2..#11)
    threePerOneRange: tail,        // jumlah NFT dari periode 3-invite-1 (invite #12+)
  };
}

/**
 * Menghitung berapa undangan tambahan yang diperlukan untuk mendapatkan 1 NFT berikutnya.
 * Mengembalikan 0 jika sudah tepat di ambang klaim baru.
 */
export function nextInvitesNeeded(validInvites: number): number {
  if (!Number.isFinite(validInvites) || validInvites < 0) return 1;

  if (validInvites < 1) return 1 - validInvites; // menuju bonus pertama
  if (validInvites < 11) {
    // periode 2-invite-1, dihitung sejak invite #2
    const usedInMid = validInvites - 1;       // 0..10
    const remainder = usedInMid % 2;          // 0 atau 1
    return remainder === 0 ? 2 : 1;
  }
  // periode 3-invite-1, dimulai dari #12
  const usedInTail = validInvites - 11;       // 0..∞
  const remainder = usedInTail % 3;           // 0,1,2
  return remainder === 0 ? 3 : (3 - remainder);
}

