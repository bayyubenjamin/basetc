/**
 * Menghitung jumlah maksimum reward yang bisa diklaim berdasarkan jumlah referral yang valid.
 * Aturan perhitungan:
 * - 1 s/d 10 referral pertama, setiap referral memberikan 2 reward (2x).
 * - Referral ke-11 dan seterusnya, setiap referral memberikan 3 reward (3x).
 *
 * @param validInvites Jumlah total referral yang valid.
 * @returns Jumlah total reward yang bisa diklaim.
 */
export function calculateMaxClaims(validInvites: number): number {
  if (validInvites <= 0) {
    return 0;
  }

  // Jika jumlah invite 10 atau kurang, kalikan langsung dengan 2.
  if (validInvites <= 10) {
    return validInvites * 2;
  }

  // Jika lebih dari 10, hitung secara terpisah.
  // 10 invite pertama menghasilkan 10 * 2 = 20 reward.
  const firstTenRewards = 20;
  
  // Sisa invite setelah 10 pertama.
  const remainingInvites = validInvites - 10;
  
  // Sisa invite tersebut masing-masing menghasilkan 3 reward.
  const subsequentRewards = remainingInvites * 3;
  
  // Total reward adalah jumlah dari kedua bagian.
  return firstTenRewards + subsequentRewards;
}

