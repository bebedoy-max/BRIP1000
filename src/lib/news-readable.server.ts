/**
 * Saring berita agar hanya item yang isinya benar-benar bisa dibaca
 * (tidak diblokir penerbit / server mati) yang tampil di kolom berita.
 */
import { extractArticle, extractStructured, isUsableArticle } from "./article-extract";
import { resolveGoogleNewsUrl } from "./google-news.server";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function fetchHtml(url: string, timeout = 7000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml,*/*;q=0.8",
        "accept-language": "id-ID,id;q=0.9,en;q=0.8",
        referer: "https://news.google.com/",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Anggap terbaca bila artikel utuh atau minimal ada articleBody terstruktur. */
function readableFromHtml(html: string): boolean {
  const parsed = extractArticle(html);
  if (isUsableArticle(parsed.blocks, parsed.title)) return true;
  const meta = extractStructured(html);
  return meta.body.trim().length > 400;
}

export type ProbeResult = { readable: boolean; url: string };

/** Cek satu berita: resolve link Google News lalu uji apakah isinya terbaca. */
export async function probeArticle(link: string): Promise<ProbeResult> {
  let url = link;
  try {
    url = await resolveGoogleNewsUrl(link);
  } catch {
    /* pakai link asli */
  }

  const html = await fetchHtml(url);
  if (html && readableFromHtml(html)) return { readable: true, url };

  // Beberapa penerbit memblokir server; coba proxy pembaca publik.
  for (const proxy of [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  ]) {
    const viaProxy = await fetchHtml(proxy, 9000);
    if (viaProxy && readableFromHtml(viaProxy)) return { readable: true, url };
  }

  return { readable: false, url };
}

/** Jalankan probe paralel terbatas, kembalikan hanya item yang terbaca. */
export async function keepReadable<T extends { link: string }>(
  items: T[],
  limit: number,
  concurrency = 6,
): Promise<T[]> {
  const kept: (T | null)[] = items.map(() => null);
  let cursor = 0;
  let found = 0;

  const worker = async () => {
    while (cursor < items.length && found < limit) {
      const at = cursor++;
      const item = items[at];
      if (!item) return;
      const result = await probeArticle(item.link);
      if (result.readable) {
        kept[at] = { ...item, link: result.url };
        found++;
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return kept.filter((item): item is T => item !== null).slice(0, limit);
}

/** Cache hasil probe per-link (30 menit) + cache daftar hasil terakhir (3 jam, dengan fallback basi). */
const probeCache = new Map<string, { at: number; result: ProbeResult }>();
const PROBE_TTL = 30 * 60_000;
let listCache: { at: number; items: unknown[] } | null = null;
const LIST_TTL = 3 * 60 * 60_000; // sesuai jadwal refresh 3 jam

async function probeCached(link: string): Promise<ProbeResult> {
  const hit = probeCache.get(link);
  if (hit && Date.now() - hit.at < PROBE_TTL) return hit.result;
  const result = await probeArticle(link);
  probeCache.set(link, { at: Date.now(), result });
  return result;
}

/**
 * Versi keepReadable dengan cache + jaminan isi:
 * - berhenti setelah batas waktu agar feed tidak pernah menggantung,
 * - bila artikel terverifikasi kurang dari `limit`, sisanya diisi kandidat lain,
 * - bila semuanya gagal, pakai hasil terakhir yang tersimpan.
 */
export async function keepReadableCached<T extends { link: string; title: string }>(
  items: T[],
  limit: number,
  budgetMs = 12_000,
): Promise<T[]> {
  if (listCache && Date.now() - listCache.at < LIST_TTL) return listCache.items as T[];

  const deadline = Date.now() + budgetMs;
  const kept: (T | null)[] = items.map(() => null);
  const fallback: (T | null)[] = items.map(() => null);
  let cursor = 0;
  let found = 0;

  const worker = async () => {
    while (cursor < items.length && found < limit && Date.now() < deadline) {
      const at = cursor++;
      const item = items[at];
      if (!item) return;
      const result = await probeCached(item.link);
      if (result.readable) {
        kept[at] = { ...item, link: result.url };
        found++;
      } else {
        fallback[at] = { ...item, link: result.url };
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(12, items.length) }, worker));

  const out = kept.filter((i): i is T => i !== null).slice(0, limit);
  if (out.length < limit) {
    // Isi kekurangan dengan kandidat lain (link penerbit sudah di-resolve bila ada)
    const used = new Set(out.map((i) => i.title.toLowerCase()));
    for (let i = 0; i < items.length && out.length < limit; i++) {
      const cand = fallback[i] ?? items[i];
      if (!cand || used.has(cand.title.toLowerCase())) continue;
      used.add(cand.title.toLowerCase());
      out.push(cand);
    }
  }

  if (out.length) listCache = { at: Date.now(), items: out };
  else if (listCache) return listCache.items as T[];
  return out;
}

