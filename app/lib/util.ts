// app/lib/util.ts

/**
 * Membagi sebuah array menjadi beberapa bagian (chunks).
 */
export function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

/**
 * Jeda eksekusi selama durasi tertentu.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Mencoba kembali (retry) sebuah fungsi async jika gagal.
 */
export async function retry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < retries - 1) {
        await sleep(delay);
      }
    }
  }
  throw lastError;
}
