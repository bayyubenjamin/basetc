// Mendefinisikan tipe data untuk profil pengguna Farcaster.
// Ini membantu memastikan konsistensi data di seluruh aplikasi.
export type FarcasterUser = {
  fid: number | null;
  username: string | null;
  displayName: string | null;
  pfpUrl: string | null;
};

// Mendefinisikan struktur data yang akan dikembalikan oleh fungsi utama.
export type FarcasterInfo = {
  fid: number | null;
  userProfile: FarcasterUser | null;
};

/**
 * [FUNGSI UTAMA YANG DIPERBAIKI]
 * Mengambil konteks pengguna dari Farcaster Mini App SDK secara andal.
 *
 * Mengapa fungsi ini penting?
 * 1. Retry Logic: Mencoba mengambil data beberapa kali (default 3 kali).
 * Ini untuk mengatasi race condition di mana aplikasi kita berjalan lebih cepat
 * daripada Farcaster App (misal: Warpcast) успел menyuntikkan SDK.
 * 2. Penanganan SDK Fleksibel: SDK Farcaster bisa memberikan 'context' dalam berbagai
 * bentuk (objek langsung, promise, atau fungsi). Kode ini menangani semua kemungkinan.
 * 3. Fallback: Jika semua percobaan gagal, fungsi ini mengembalikan nilai null
 * yang aman, mencegah aplikasi crash.
 *
 * @param retries Jumlah percobaan ulang.
 * @param delay Jeda waktu antar percobaan dalam milidetik.
 * @returns {Promise<FarcasterInfo>} Sebuah promise yang resolve dengan informasi pengguna.
 */
export async function getFarcasterIds(retries = 3, delay = 300): Promise<FarcasterInfo> {
  for (let i = 0; i < retries; i++) {
    try {
      // Impor SDK Farcaster secara dinamis.
      const mod = await import('@farcaster/miniapp-sdk');
      const rawCtx: any = (mod as any)?.sdk?.context;

      // Jika SDK belum siap, rawCtx akan null. Lanjutkan ke percobaan berikutnya.
      if (!rawCtx) {
        throw new Error("SDK context is not yet available.");
      }
      
      let ctx: any = null;
      // Cek apakah 'context' adalah sebuah fungsi (API modern).
      if (typeof rawCtx === 'function') {
        ctx = await rawCtx.call((mod as any).sdk);
      // Cek apakah 'context' adalah sebuah promise (API pertengahan).
      } else if (rawCtx && typeof rawCtx.then === 'function') {
        ctx = await rawCtx;
      // Asumsikan 'context' adalah objek biasa (API lama).
      } else {
        ctx = rawCtx ?? null;
      }

      const user = ctx?.user;
      
      // Jika kita berhasil mendapatkan FID, berarti sukses!
      if (user?.fid) {
        return {
          fid: user.fid,
          userProfile: {
            fid: user.fid,
            username: user.username,
            displayName: user.displayName,
            pfpUrl: user.pfpUrl,
          },
        };
      }
    } catch (e: any) {
      // Catat error percobaan di console untuk debugging, tapi jangan hentikan loop.
      console.warn(`[getFarcasterIds attempt ${i + 1}/${retries}] failed:`, e.message);
    }
    
    // Tunggu sejenak sebelum mencoba lagi (jika ini bukan percobaan terakhir).
    if (i < retries - 1) {
      await new Promise(res => setTimeout(res, delay));
    }
  }

  // Jika semua percobaan gagal, kembalikan objek default.
  console.error("Failed to get Farcaster context after all retries.");
  return { fid: null, userProfile: null };
}

/**
 * Memberi sinyal ke Farcaster bahwa Mini App sudah siap dan selesai memuat.
 * Ini adalah praktik terbaik dan harus dipanggil sesegera mungkin.
 * Dipanggil di useEffect() pada file page.tsx.
 */
export async function sdkReady() {
  try {
    const { sdk } = await import('@farcaster/miniapp-sdk');
    // Fungsi ini akan memberitahu host (misal: Warpcast) bahwa frame mini app
    // sudah bisa dihilangkan loading spinner-nya.
    await sdk.actions.ready();
  } catch (e) {
    // Abaikan error jika SDK gagal dimuat (misal: saat dibuka di browser biasa).
  }
}

