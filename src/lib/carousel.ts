import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { driveThumb } from "@/lib/face";

const db = supabase as unknown as SupabaseClient;

/** Bagian konten yang bisa dipakai sebagai sumber slide carousel. */
export const carouselSources = [
  { value: "event", label: "The Event's" },
  { value: "project", label: "Project IT" },
  { value: "diary", label: "Buku Harian IT" },
] as const;

export type CarouselSourceKey = (typeof carouselSources)[number]["value"];

export type CarouselSourceConfig = {
  sumber: CarouselSourceKey;
  aktif: boolean;
  jumlah: number;
  urutan: number;
  /** Konten terpilih; kosong = pakai konten terbaru sejumlah `jumlah`. */
  item_ids: string[];
};

/** Default: 5 konten terakhir dari masing-masing bagian. */
export const defaultCarouselConfig: CarouselSourceConfig[] = carouselSources.map((s, i) => ({
  sumber: s.value,
  aktif: true,
  jumlah: 10,
  urutan: i + 1,
  item_ids: [],
}));

/** Ambil pengaturan carousel; jatuh ke default bila tabel belum ada / kosong. */
export async function loadCarouselConfig(): Promise<CarouselSourceConfig[]> {
  try {
    const { data, error } = await db
      .from("carousel_sources")
      .select("sumber,aktif,jumlah,urutan,item_ids")
      .order("urutan", { ascending: true });
    if (error || !data?.length) return defaultCarouselConfig;
    const rows = data as CarouselSourceConfig[];
    return carouselSources.map((s, i) => {
      const row = rows.find((r) => r.sumber === s.value);
      return row
        ? {
            ...row,
            jumlah: Math.max(1, Math.min(20, Number(row.jumlah) || 10)),
            item_ids: Array.isArray(row.item_ids) ? row.item_ids : [],
          }
        : { sumber: s.value, aktif: false, jumlah: 10, urutan: i + 1, item_ids: [] };
    });
  } catch {
    return defaultCarouselConfig;
  }
}

/** Ekstrak ID file dari berbagai format tautan Google Drive. */
export function extractDriveId(photo: string): string | null {
  const m =
    photo.match(/drive\.google\.com\/(?:file\/d\/|open\?[^ ]*?\bid=|uc\?[^ ]*?\bid=)([\w-]+)/i) ??
    photo.match(/lh3\.googleusercontent\.com\/d\/([\w-]+)/i);
  return m?.[1] ?? null;
}

/** Sumber gambar slide: URL langsung, tautan Google Drive, atau ID file Drive. */
export function slideImageSrc(photo: string, size = 1200) {
  const id = extractDriveId(photo);
  if (id) return driveThumb(id, size);
  return /^(https?:|data:|blob:)/i.test(photo) ? photo : driveThumb(photo, size);
}

/** Semua kandidat URL gambar, dicoba berurutan bila yang sebelumnya gagal. */
export function slideImageSources(photo: string, size = 1200): string[] {
  const raw = photo.trim();
  if (!raw) return [];
  const id = extractDriveId(raw) ?? (/^(https?:|data:|blob:)/i.test(raw) ? null : raw);
  if (!id) return [raw];
  return [
    driveThumb(id, size),
    `https://lh3.googleusercontent.com/d/${id}=w${size}`,
    `https://drive.google.com/uc?export=view&id=${id}`,
    driveThumb(id, 400),
  ];
}

/** URL alternatif bila thumbnail Drive gagal dimuat (mis. kena rate limit). */
export function slideImageFallback(photo: string): string | null {
  return slideImageSources(photo)[1] ?? null;
}

/** Acak urutan slide (Fisher–Yates). */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const ai = a[i] as T;
    a[i] = a[j] as T;
    a[j] = ai;
  }
  return a;
}

export type CarouselCandidate = { id: string; label: string; sub: string };

/** Daftar konten terakhir sebuah bagian untuk diceklis admin. */
export async function loadCarouselCandidates(
  sumber: CarouselSourceKey,
  limit = 10,
): Promise<CarouselCandidate[]> {
  const fmt = (v: string | null) =>
    v ? new Date(v.length <= 10 ? `${v}T00:00:00` : v).toLocaleDateString("id-ID", { dateStyle: "long" }) : "—";

  if (sumber === "event") {
    const { data } = await db
      .from("events")
      .select("id,nama_event,tanggal_mulai")
      .order("tanggal_mulai", { ascending: false, nullsFirst: false })
      .limit(limit);
    return ((data ?? []) as { id: string; nama_event: string; tanggal_mulai: string | null }[]).map(
      (e) => ({ id: e.id, label: e.nama_event, sub: fmt(e.tanggal_mulai) }),
    );
  }
  if (sumber === "project") {
    const { data } = await db
      .from("projects")
      .select("id,nama_project,deadline")
      .order("created_at", { ascending: false })
      .limit(limit);
    return ((data ?? []) as { id: string; nama_project: string; deadline: string | null }[]).map(
      (p) => ({ id: p.id, label: p.nama_project, sub: p.deadline ? `Deadline ${fmt(p.deadline)}` : "Project berjalan" }),
    );
  }
  const { data } = await db
    .from("it_diary_logs")
    .select("id,nama_kegiatan,tanggal")
    .order("tanggal", { ascending: false })
    .limit(limit);
  return ((data ?? []) as { id: string; nama_kegiatan: string; tanggal: string }[]).map((d) => ({
    id: d.id,
    label: d.nama_kegiatan,
    sub: fmt(d.tanggal),
  }));
}
