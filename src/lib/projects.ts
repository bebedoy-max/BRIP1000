import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

const db = supabase as unknown as SupabaseClient;

export type ProjectItem = { id: string; label: string };

export type ParamDef = {
  key: string;
  /** Label satuan, mis. "Unit Kerja". */
  noun: string;
  /** Label kolom daftar item pada tabel detail, mis. "Nama Unit Kerja". */
  itemLabel: string;
  fetch: () => Promise<ProjectItem[]>;
};

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

async function rows(table: string, cols: string, order: string) {
  const { data, error } = await db.from(table).select(cols).order(order);
  if (error) throw error;
  return (data ?? []) as unknown as Record<string, unknown>[];
}

export const paramDefs: ParamDef[] = [
  {
    key: "uker",
    itemLabel: "Nama Unit Kerja",
    noun: "Unit Kerja",
    fetch: async () =>
      (await rows("ukers", "id, kode_uker, nama_uker", "kode_uker")).map((r) => ({
        id: `uker:${s(r["id"])}`,
        label: `${s(r["kode_uker"])} — ${s(r["nama_uker"])}`,
      })),
  },
  {
    key: "pekerja",
    itemLabel: "Nama Pekerja",
    noun: "Pekerja",
    fetch: async () =>
      (await rows("employees", "id, nama, personal_number", "nama")).map((r) => ({
        id: `pekerja:${s(r["id"])}`,
        label: [s(r["personal_number"]), s(r["nama"])].filter(Boolean).join(" — "),
      })),
  },
  {
    key: "perangkat",
    itemLabel: "Nama Perangkat",
    noun: "Perangkat",
    fetch: async () =>
      (await rows("it_devices", "id, nama_perangkat, nama_pengguna", "nama_perangkat")).map((r) => ({
        id: `perangkat:${s(r["id"])}`,
        label: [s(r["nama_perangkat"]), s(r["nama_pengguna"])].filter(Boolean).join(" — "),
      })),
  },
  {
    key: "atm",
    itemLabel: "Lokasi ATM",
    noun: "ATM",
    fetch: async () =>
      (await rows("atm_machines", "id, tid, lokasi", "tid")).map((r) => ({
        id: `atm:${s(r["id"])}`,
        label: `ATM ${s(r["tid"])} — ${s(r["lokasi"])}`,
      })),
  },
  {
    key: "crm",
    itemLabel: "Lokasi CRM",
    noun: "CRM",
    fetch: async () =>
      (await rows("crm_machines", "id, tid, lokasi", "tid")).map((r) => ({
        id: `crm:${s(r["id"])}`,
        label: `CRM ${s(r["tid"])} — ${s(r["lokasi"])}`,
      })),
  },
  {
    key: "edc_uko",
    itemLabel: "EDC UKO",
    noun: "EDC UKO",
    fetch: async () =>
      (await rows("edc_machines", "id, tid, nama_merchant, kategori_edc", "tid"))
        .filter((r) => s(r["kategori_edc"]).toLowerCase() === "uko")
        .map((r) => ({
          id: `edc:${s(r["id"])}`,
          label: `${s(r["tid"])} — ${s(r["nama_merchant"])}`,
        })),
  },
  {
    key: "edc_merchant",
    itemLabel: "Merchant EDC",
    noun: "EDC Merchant",
    fetch: async () =>
      (await rows("edc_machines", "id, tid, nama_merchant, kategori_edc", "tid"))
        .filter((r) => s(r["kategori_edc"]).toLowerCase() === "merchant")
        .map((r) => ({
          id: `edc:${s(r["id"])}`,
          label: `${s(r["tid"])} — ${s(r["nama_merchant"])}`,
        })),
  },
];

export function findParam(key: string | null | undefined) {
  return paramDefs.find((p) => p.key === key) ?? null;
}

/** Label opsi parameter: "100% 24 Unit Kerja". */
export function paramLabel(def: ParamDef, total: number) {
  return `100% ${total} ${def.noun}`;
}

/** Ambil jumlah item untuk seluruh parameter (dipakai untuk label dropdown). */
export async function fetchParamTotals(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const d of paramDefs) {
    try {
      out[d.key] = (await d.fetch()).length;
    } catch {
      out[d.key] = 0;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Target custom                                                       */
/* ------------------------------------------------------------------ */

/** Sumber data yang bisa dipilih pada target pencapaian custom. */
export const customSources: { key: string; label: string; fetch: () => Promise<ProjectItem[]> }[] = [
  { key: "uker", label: "Data Unit Kerja", fetch: () => findParam("uker")!.fetch() },
  { key: "pekerja", label: "Data Pekerja", fetch: () => findParam("pekerja")!.fetch() },
  { key: "atm", label: "Mesin ATM", fetch: () => findParam("atm")!.fetch() },
  { key: "crm", label: "Mesin CRM", fetch: () => findParam("crm")!.fetch() },
  {
    key: "edc",
    label: "Mesin EDC",
    fetch: async () =>
      (await rows("edc_machines", "id, tid, nama_merchant, kategori_edc", "tid")).map((r) => ({
        id: `edc:${s(r["id"])}`,
        label: `${s(r["tid"])} — ${s(r["nama_merchant"])} (${s(r["kategori_edc"])})`,
      })),
  },
  { key: "perangkat", label: "Data Perangkat IT", fetch: () => findParam("perangkat")!.fetch() },
];

export type ProjectRow = Record<string, unknown>;

/** Daftar parameter (multi) sebuah project, kompatibel dengan kolom lama `parameter`. */
export function projectParamKeys(p: ProjectRow | null | undefined): string[] {
  if (!p) return [];
  const raw = p["parameters"];
  const arr = Array.isArray(raw) ? raw.map((v) => String(v)) : [];
  if (arr.length) return arr;
  const legacy = p["parameter"] ? String(p["parameter"]) : "";
  if (!legacy) return [];
  if (legacy === "atm_crm") return ["atm", "crm"];
  return [legacy];
}

/** Item custom yang tersimpan pada project. */
export function projectCustomItems(p: ProjectRow | null | undefined): ProjectItem[] {
  const raw = p?.["custom_items"];
  const arr = typeof raw === "string" ? safeJson(raw) : raw;
  if (!Array.isArray(arr)) return [];
  return arr
    .map((v) => v as Record<string, unknown>)
    .filter((v) => v && v["id"])
    .map((v) => ({ id: String(v["id"]), label: String(v["label"] ?? v["id"]) }));
}

function safeJson(v: string): unknown {
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

/** Ringkasan label parameter untuk tampilan. */
export function projectParamSummary(p: ProjectRow): string {
  const nouns = projectParamKeys(p)
    .map((k) => findParam(k)?.noun)
    .filter(Boolean) as string[];
  const custom = projectCustomItems(p);
  if (custom.length) nouns.push(`Custom (${custom.length})`);
  return nouns.length ? nouns.join(", ") : "—";
}

/** Seluruh item target sebuah project (parameter terceklis + item custom), unik per id. */
export async function resolveProjectItems(p: ProjectRow): Promise<ProjectItem[]> {
  const keys = projectParamKeys(p);
  const lists = await Promise.all(
    keys.map(async (k) => {
      const def = findParam(k);
      if (!def) return [] as ProjectItem[];
      try {
        return await def.fetch();
      } catch {
        return [] as ProjectItem[];
      }
    }),
  );
  const map = new Map<string, ProjectItem>();
  for (const list of [...lists, projectCustomItems(p)])
    for (const i of list) if (!map.has(i.id)) map.set(i.id, i);
  return [...map.values()];
}

/** Label kolom berdasarkan prefix id item (sumber data aslinya). */
const prefixItemLabel: Record<string, string> = {
  uker: "Nama Unit Kerja",
  pekerja: "Nama Pekerja",
  perangkat: "Nama Perangkat",
  atm: "Lokasi ATM",
  crm: "Lokasi CRM",
  edc: "Merchant EDC",
};

/** Label kolom item pada tabel detail project, mengikuti parameter project. */
export function projectItemColumnLabel(p: ProjectRow | null | undefined): string {
  const labels = projectParamKeys(p)
    .map((k) => findParam(k)?.itemLabel)
    .filter(Boolean) as string[];

  // Parameter custom: baca sumber datanya dari prefix id tiap item.
  for (const it of projectCustomItems(p)) {
    const prefix = it.id.split(":")[0] ?? "";
    const label = prefixItemLabel[prefix];
    labels.push(label ?? "Item Custom");
  }

  const uniq = [...new Set(labels)];
  if (uniq.length === 0) return "Item";
  if (uniq.length === 1) return uniq[0]!;
  return uniq.join(" / ");
}
