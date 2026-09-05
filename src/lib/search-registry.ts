export type SearchRef = {
  /** Kolom foreign key pada tabel modul. */
  column: string;
  /** Tabel referensi. */
  table: string;
  /** Kolom teks pada tabel referensi yang ikut dicari. */
  labelColumns: string[];
};

export type SearchModule = {
  /** Supabase table name. */
  table: string;
  /** Module label shown as result group. */
  label: string;
  /** Admin route the result links to. */
  route: string;
  /**
   * Kolom teks tambahan yang pasti dicari. Kosongkan agar seluruh kolom teks
   * ditemukan otomatis saat runtime (mendukung kolom/menu baru).
   */
  columns?: string[];
  /** Relasi yang ikut dicari (mis. jabatan pada data pekerja). */
  refs?: SearchRef[];
  /** Builds the result title. */
  title?: (row: Record<string, unknown>) => string;
  /** Builds the result subtitle. */
  subtitle?: (row: Record<string, unknown>) => string;
  /** Role gate. */
  need?: "it" | "event" | "super";
};

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

const ukerRef = (column = "uker_id"): SearchRef => ({
  column,
  table: "ukers",
  labelColumns: ["kode_uker", "nama_uker", "tipe", "alamat"],
});

export const searchModules: SearchModule[] = [
  {
    table: "ukers",
    label: "Unit Kerja",
    route: "/admin/uker",
    title: (r) => `${s(r["kode_uker"])} — ${s(r["nama_uker"])}`,
    subtitle: (r) => [s(r["tipe"]), s(r["alamat"])].filter(Boolean).join(" · "),
  },
  {
    table: "employees",
    label: "Data Pekerja",
    route: "/admin/pegawai",
    refs: [
      { column: "jabatan_id", table: "job_titles", labelColumns: ["nama_jabatan", "akses_level"] },
      ukerRef(),
    ],
    title: (r) => s(r["nama"]),
    subtitle: (r) => [s(r["personal_number"]), s(r["status_karyawan"])].filter(Boolean).join(" · "),
  },
  {
    table: "job_titles",
    label: "Kategori Jabatan",
    route: "/admin/jabatan",
    title: (r) => s(r["nama_jabatan"]),
    subtitle: (r) => [s(r["tipe_unit_kerja"]), s(r["akses_level"])].filter(Boolean).join(" · "),
    need: "it",
  },
  {
    table: "atm_machines",
    label: "Mesin ATM",
    route: "/admin/atm",
    refs: [ukerRef()],
    title: (r) => s(r["tid"]) || s(r["kode_atm"]),
    subtitle: (r) => [s(r["lokasi"]), s(r["merk"]), s(r["ip_address"])].filter(Boolean).join(" · "),
  },
  {
    table: "crm_machines",
    label: "Mesin CRM",
    route: "/admin/crm",
    refs: [ukerRef()],
    title: (r) => s(r["tid"]),
    subtitle: (r) => [s(r["lokasi"]), s(r["merk"]), s(r["ip_address"])].filter(Boolean).join(" · "),
  },
  {
    table: "edc_machines",
    label: "Mesin EDC",
    route: "/admin/edc",
    refs: [ukerRef()],
    title: (r) => s(r["tid"]),
    subtitle: (r) => [s(r["nama_merchant"]), s(r["kategori_edc"])].filter(Boolean).join(" · "),
  },
  {
    table: "device_types",
    label: "Jenis Perangkat",
    route: "/admin/jenis-perangkat",
    title: (r) => s(r["jenis_perangkat"]),
    subtitle: (r) => [s(r["level_fungsi"]), s(r["deskripsi"])].filter(Boolean).join(" · "),
    need: "it",
  },
  {
    table: "it_devices",
    label: "Data Perangkat IT",
    route: "/admin/perangkat",
    refs: [
      ukerRef(),
      { column: "jenis_id", table: "device_types", labelColumns: ["jenis_perangkat", "level_fungsi"] },
      { column: "pengguna_id", table: "employees", labelColumns: ["nama", "personal_number"] },
    ],
    title: (r) => s(r["nama_perangkat"]),
    subtitle: (r) => [s(r["merk"]), s(r["serial_number"])].filter(Boolean).join(" · "),
    need: "it",
  },

  {
    table: "projects",
    label: "Project IT",
    route: "/admin/project",
    title: (r) => s(r["nama_project"]),
    subtitle: (r) => s(r["deskripsi"]).slice(0, 80),
    need: "it",
  },
  {
    table: "tutorials",
    label: "Tutorial",
    route: "/admin/tutorial",
    title: (r) => s(r["judul"]),
    subtitle: (r) => s(r["kategori"]),
    need: "it",
  },
  {
    table: "photos",
    label: "Event",
    route: "/admin/foto",
    title: (r) => s(r["judul"]),
    subtitle: (r) => s(r["deskripsi"]).slice(0, 80),
    need: "it",
  },
  {
    table: "it_tickets",
    label: "Tiket IT",
    route: "/admin/tiket",
    refs: [ukerRef()],
    title: (r) => s(r["judul"]),
    subtitle: (r) => s(r["status"]),
  },
  {
    table: "events",
    label: "Event & Absensi",
    route: "/admin/event",
    title: (r) => s(r["nama_event"]),
    subtitle: (r) => s(r["deskripsi"]).slice(0, 80),
    need: "event",
  },
  {

    table: "audit_logs",
    label: "Audit Log",
    route: "/admin/audit",
    columns: ["action", "table_name"],
    title: (r) => `${s(r["action"])} · ${s(r["table_name"])}`,
    subtitle: (r) => s(r["created_at"]),
    need: "super",
  },
];

/** Kolom yang tidak berguna untuk pencarian teks. */
const SKIP_COLUMNS = /^(id|created_at|updated_at|.*_id|.*_url|qr_token|password.*)$/;

/** Tebak judul baris ketika modul tidak menyediakan title(). */
export function guessTitle(row: Record<string, unknown>): string {
  for (const k of ["nama", "judul", "nama_event", "title", "tid", "kode_uker"]) {
    if (typeof row[k] === "string" && row[k]) return String(row[k]);
  }
  const first = Object.entries(row).find(
    ([k, v]) => typeof v === "string" && v !== "" && !SKIP_COLUMNS.test(k),
  );
  return first ? String(first[1]) : "(tanpa judul)";
}

/** Cari otomatis kolom teks dari satu baris contoh. */
export function textColumnsFromRow(row: Record<string, unknown> | undefined): string[] {
  if (!row) return [];
  return Object.entries(row)
    .filter(([k, v]) => typeof v === "string" && !SKIP_COLUMNS.test(k))
    .map(([k]) => k);
}
