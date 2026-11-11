// Pembatas laju sederhana per alamat IP (memori proses). Pada serverless, instance yang
// sama melayani banyak permintaan berurutan sehingga ini efektif menahan tebak-tebakan
// beruntun; untuk jaminan lintas-instance gunakan pembatas di CDN/WAF.
import { getRequest } from "@tanstack/react-start/server";

const buckets = new Map<string, { n: number; reset: number }>();
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, v] of buckets) if (v.reset <= now) buckets.delete(k);
  if (buckets.size > 20_000) buckets.clear();
}

/** Alamat IP pemanggil (header proxy), atau "unknown". */
export function clientIp(): string {
  try {
    const h = getRequest()?.headers;
    const fwd = h?.get("x-forwarded-for")?.split(",")[0]?.trim();
    return fwd || h?.get("x-real-ip") || h?.get("cf-connecting-ip") || "unknown";
  } catch {
    return "unknown";
  }
}

/** Tambah hitungan; kembalikan jumlah dalam jendela waktu saat ini. */
export function bump(key: string, windowMs: number): number {
  const now = Date.now();
  sweep(now);
  const cur = buckets.get(key);
  if (!cur || cur.reset <= now) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    return 1;
  }
  cur.n += 1;
  return cur.n;
}

/** Jumlah hitungan saat ini tanpa menambah. */
export function peek(key: string): number {
  const cur = buckets.get(key);
  return cur && cur.reset > Date.now() ? cur.n : 0;
}

/** Batasi: lempar error bila lebih dari `limit` permintaan per `windowMs` untuk IP ini. */
export function limit(name: string, max: number, windowMs: number) {
  const n = bump(`${name}:${clientIp()}`, windowMs);
  if (n > max) throw new Error("Terlalu banyak permintaan. Coba lagi beberapa menit lagi.");
}

/** Batasi percobaan GAGAL (mis. tebak Personal Number): cek dulu, hitung hanya jika gagal. */
export function assertNotLocked(name: string, max: number) {
  if (peek(`${name}:${clientIp()}`) >= max)
    throw new Error("Terlalu banyak percobaan salah. Coba lagi 10 menit lagi.");
}
export function recordFailure(name: string, windowMs: number) {
  bump(`${name}:${clientIp()}`, windowMs);
}
