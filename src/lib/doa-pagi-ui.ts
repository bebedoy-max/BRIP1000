/** Tipe & helper bersama untuk Absensi, Doa & Briefing Pagi. */

export type DoaPagiSection = {
  id: string;
  ukerId: string | null;
  ukerNama: string;
  urutan: number;
  nama: string;
  deskripsi: string;
  keterangan: string;
  pekerja: string[];
};

export type DoaPagiRecord = {
  sectionId: string;
  pekerja: string;
  tanggal: string;
  qris: string;
  kehadiran: string;
};

/** Pilihan status kehadiran (mengikuti mockup tampilan). */
export const kehadiranOptions = [
  "Hadir",
  "Belum Hadir",
  "Sakit",
  "Cuti",
  "Zoom",
  "Di BRI Unit",
  "Ke Kanwil",
  "Ke KPKNL",
  "Backup",
  "Izin",
  "Tanpa Keterangan",
] as const;

export type Kehadiran = (typeof kehadiranOptions)[number];

/** Nilai QRIS untuk pekerja yang tidak melakukan absen QRIS. */
export const QRIS_KOSONG = "Kosong";

/**
 * Kode singkat yang diketik pada kolom QRIS lalu Enter:
 * mengubah QRIS menjadi "Kosong" dan mengatur status kehadiran.
 */
export const kehadiranShortcuts: Record<string, Kehadiran> = {
  bh: "Belum Hadir",
  "belum hadir": "Belum Hadir",
  sakit: "Sakit",
  cuti: "Cuti",
  zoom: "Zoom",
  unit: "Di BRI Unit",
  "di bri unit": "Di BRI Unit",
  kanwil: "Ke Kanwil",
  "ke kanwil": "Ke Kanwil",
  kpknl: "Ke KPKNL",
  "ke kpknl": "Ke KPKNL",
  backup: "Backup",
  izin: "Izin",
  tk: "Tanpa Keterangan",
  "tanpa keterangan": "Tanpa Keterangan",
};

export function shortcutFor(value: string): Kehadiran | null {
  return kehadiranShortcuts[value.trim().toLowerCase()] ?? null;
}

/** Satu pilihan kehadiran yang bisa diatur admin: kode singkat + label. */
export type KehadiranOption = { shortcut: string; label: string };

/** Daftar pilihan bawaan (dipakai bila admin belum mengatur apa pun). */
export const defaultKehadiranOptions: KehadiranOption[] = [
  { shortcut: "h", label: "Hadir" },
  { shortcut: "bh", label: "Belum Hadir" },
  { shortcut: "sakit", label: "Sakit" },
  { shortcut: "cuti", label: "Cuti" },
  { shortcut: "zoom", label: "Zoom" },
  { shortcut: "un", label: "Di BRI Unit" },
  { shortcut: "kanwil", label: "Ke Kanwil" },
  { shortcut: "kpknl", label: "Ke KPKNL" },
  { shortcut: "backup", label: "Backup" },
  { shortcut: "izin", label: "Izin" },
  { shortcut: "tk", label: "Tanpa Keterangan" },
];

/** Bersihkan daftar pilihan dari database/form agar selalu valid & unik. */
export function normalizeKehadiranOptions(raw: unknown): KehadiranOption[] {
  const arr = Array.isArray(raw) ? raw : [];
  const out: KehadiranOption[] = [];
  const seen = new Set<string>();
  for (const item of arr) {
    const o = (item ?? {}) as Partial<KehadiranOption>;
    const label = String(o.label ?? "").trim();
    const shortcut = String(o.shortcut ?? "")
      .trim()
      .toLowerCase();
    if (!label || seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    out.push({ shortcut, label });
  }
  return out.length ? out : defaultKehadiranOptions;
}

/** Tulis satu pilihan sebagai teks "[kode]Label". */
export function formatKehadiranOption(o: KehadiranOption) {
  return `${o.shortcut ? `[${o.shortcut}]` : ""}${o.label}`;
}

/** Baca teks "[kode]Label" menjadi pilihan kehadiran. */
export function parseKehadiranOption(text: string): KehadiranOption {
  const m = /^\s*\[([^\]]*)\]\s*(.*)$/.exec(text);
  if (m) return { shortcut: m[1]!.trim().toLowerCase(), label: m[2]!.trim() };
  return { shortcut: "", label: text.trim() };
}

/** Cari label kehadiran dari kode singkat yang diketik pada kolom QRIS. */
export function matchKehadiran(value: string, options: KehadiranOption[]): string | null {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  for (const o of options) {
    if (o.shortcut && o.shortcut.toLowerCase() === v) return o.label;
    if (o.label.toLowerCase() === v) return o.label;
  }
  return null;
}


/** Kolom hari kerja pada tampilan: S (Senin), S (Selasa), R, K, J. */
export const weekdayLabels = ["S", "S", "R", "K", "J"] as const;
export const weekdayNames = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"] as const;

export function toIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Tanggal Senin–Jumat pada minggu dari tanggal acuan. */
export function workWeekDates(ref: Date = new Date()): string[] {
  const base = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const dow = base.getDay(); // 0 Minggu .. 6 Sabtu
  const offsetToMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(base);
  monday.setDate(base.getDate() + offsetToMonday);
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return toIsoDate(d);
  });
}

/** Hadir bila QRIS terisi dan bukan "Kosong". */
export function isQrisFilled(qris: string | null | undefined) {
  const v = (qris ?? "").trim();
  return !!v && v.toLowerCase() !== QRIS_KOSONG.toLowerCase();
}

export function recordKey(sectionId: string, pekerja: string, tanggal: string) {
  return `${sectionId}|${pekerja}|${tanggal}`;
}

/** Pengaturan tampilan satu logo pada header absensi. */
export type DoaLogo = {
  /** URL/data URL gambar pengganti; null memakai logo bawaan. */
  url: string | null;
  /** Tinggi logo dalam piksel. */
  height: number;
  /** Geser horizontal (px, negatif = ke kiri). */
  x: number;
  /** Geser vertikal (px, negatif = ke atas). */
  y: number;
};

export type DoaLogoKey = "bo" | "danantara" | "bri";

export type DoaLogoSettings = Record<DoaLogoKey, DoaLogo>;

export const doaLogoLabels: Record<DoaLogoKey, string> = {
  bo: "Logo BO Pringsewu",
  danantara: "Logo Danantara",
  bri: "Logo BRI",
};

export const defaultDoaLogos: DoaLogoSettings = {
  bo: { url: null, height: 52, x: 0, y: 0 },
  danantara: { url: null, height: 40, x: 0, y: 0 },
  bri: { url: null, height: 40, x: 0, y: 0 },
};

/** Normalisasi data dari database agar selalu lengkap. */
export function normalizeDoaLogos(raw: unknown): DoaLogoSettings {
  const src = (raw ?? {}) as Partial<Record<DoaLogoKey, Partial<DoaLogo>>>;
  const keys: DoaLogoKey[] = ["bo", "danantara", "bri"];
  const out = {} as DoaLogoSettings;
  for (const k of keys) {
    const d = defaultDoaLogos[k];
    const v = src[k] ?? {};
    out[k] = {
      url: typeof v.url === "string" && v.url.trim() ? v.url : null,
      height: Number.isFinite(Number(v.height)) ? Number(v.height) : d.height,
      x: Number.isFinite(Number(v.x)) ? Number(v.x) : d.x,
      y: Number.isFinite(Number(v.y)) ? Number(v.y) : d.y,
    };
  }
  return out;
}
