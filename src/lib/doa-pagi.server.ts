/** Helper server-only untuk Absensi, Doa & Briefing Pagi. */
import { normalizeDoaLogos } from "@/lib/doa-pagi-ui";
import type { DoaLogoSettings, DoaPagiRecord, DoaPagiSection } from "@/lib/doa-pagi-ui";

type Db = { from: (t: string) => any };

async function admin(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Db;
}

function toSection(row: Record<string, any>): DoaPagiSection {
  return {
    id: String(row["id"]),
    ukerId: row["uker_id"] ?? null,
    ukerNama: String(row["uker_nama"] ?? ""),
    urutan: Number(row["urutan"] ?? 1),
    nama: String(row["nama"] ?? ""),
    deskripsi: String(row["deskripsi"] ?? ""),
    keterangan: String(row["keterangan"] ?? ""),
    pekerja: (row["pekerja"] as string[]) ?? [],
  };
}

/** Hanya level admin panel yang boleh mengubah pengaturan bagian. */
export async function isPanelAdmin(userId: string) {
  const db = await admin();
  const { data } = await db.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  return roles.includes("superadmin") || roles.includes("it_admin");
}

export async function assertAdmin(userId: string) {
  if (!(await isPanelAdmin(userId))) throw new Error("Akses admin diperlukan.");
}

export async function listUkers(): Promise<{ id: string; nama: string }[]> {
  const db = await admin();
  const { data, error } = await db
    .from("ukers")
    .select("id,nama_uker")
    .order("nama_uker", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: Record<string, any>) => ({
    id: String(r["id"]),
    nama: String(r["nama_uker"] ?? ""),
  }));
}

/** Daftar pekerja untuk dipilih pada pengaturan bagian. */
export async function listEmployees(
  ukerId?: string | null,
): Promise<{ nama: string; jabatan: string; ukerId: string | null }[]> {
  const db = await admin();
  const [{ data: titles }, empRes] = await Promise.all([
    db.from("job_titles").select("id,nama_jabatan"),
    (() => {
      let q = db.from("employees").select("nama,jabatan_id,uker_id").order("nama", { ascending: true }).limit(2000);
      if (ukerId) q = q.eq("uker_id", ukerId);
      return q;
    })(),
  ]);
  const titleMap = new Map<string, string>(
    ((titles ?? []) as Record<string, any>[]).map((t) => [
      String(t["id"]),
      String(t["nama_jabatan"] ?? ""),
    ]),
  );
  const seen = new Set<string>();
  const out: { nama: string; jabatan: string; ukerId: string | null }[] = [];
  for (const r of ((empRes as any)?.data ?? []) as Record<string, any>[]) {
    const nama = String(r["nama"] ?? "").trim();
    const uid = r["uker_id"] ? String(r["uker_id"]) : null;
    const key = `${uid ?? "-"}|${nama}`;
    if (!nama || seen.has(key)) continue;
    seen.add(key);
    const jab = titleMap.get(String(r["jabatan_id"] ?? "")) ?? "";
    out.push({ nama, jabatan: jab.trim() || "Tanpa Jabatan", ukerId: uid });
  }
  return out;
}



export async function listSections(ukerId?: string | null): Promise<DoaPagiSection[]> {
  const db = await admin();
  let q = db.from("doa_pagi_sections").select("*").order("urutan", { ascending: true });
  if (ukerId) q = q.eq("uker_id", ukerId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map(toSection);
}

export type SectionPayload = Omit<DoaPagiSection, "id"> & { id?: string };

export async function saveSection(payload: SectionPayload) {
  const db = await admin();
  const row = {
    uker_id: payload.ukerId,
    uker_nama: payload.ukerNama,
    urutan: payload.urutan,
    nama: payload.nama,
    deskripsi: payload.deskripsi,
    keterangan: payload.keterangan,
    pekerja: payload.pekerja,
    updated_at: new Date().toISOString(),
  };
  if (payload.id) {
    const { error } = await db.from("doa_pagi_sections").update(row).eq("id", payload.id);
    if (error) throw new Error(error.message);
    return payload.id;
  }
  const { data, error } = await db
    .from("doa_pagi_sections")
    .insert(row)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return String(data?.id);
}

export async function deleteSection(id: string) {
  const db = await admin();
  const { error } = await db.from("doa_pagi_sections").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Absensi satu minggu kerja (Senin–Jumat) untuk sekumpulan bagian. */
export async function listRecords(sectionIds: string[], dates: string[]): Promise<DoaPagiRecord[]> {
  if (!sectionIds.length || !dates.length) return [];
  const db = await admin();
  const { data, error } = await db
    .from("doa_pagi_absensi")
    .select("section_id,pekerja,tanggal,qris,kehadiran")
    .in("section_id", sectionIds)
    .gte("tanggal", dates[0]!)
    .lte("tanggal", dates[dates.length - 1]!);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: Record<string, any>) => ({
    sectionId: String(r["section_id"]),
    pekerja: String(r["pekerja"] ?? ""),
    tanggal: String(r["tanggal"] ?? ""),
    qris: String(r["qris"] ?? ""),
    kehadiran: String(r["kehadiran"] ?? "Hadir"),
  }));
}

export async function upsertRecord(input: {
  sectionId: string;
  pekerja: string;
  tanggal: string;
  qris: string;
  kehadiran: string;
}) {
  const db = await admin();
  const { error } = await db.from("doa_pagi_absensi").upsert(
    {
      section_id: input.sectionId,
      pekerja: input.pekerja,
      tanggal: input.tanggal,
      qris: input.qris,
      kehadiran: input.kehadiran,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "section_id,pekerja,tanggal" },
  );
  if (error) throw new Error(error.message);
}

/** Saran merchant QRIS dari database merchant. */
export async function searchQrisMerchants(
  term: string,
): Promise<{ nama: string; storeId: string }[]> {
  const q = term.trim();
  if (q.length < 2) return [];
  const db = await admin();
  const { data } = await db
    .from("qris_merchants")
    .select("nama_merchant,store_id")
    .ilike("nama_merchant", `%${q}%`)
    .order("nama_merchant", { ascending: true })
    .limit(8);
  return (data ?? []).map((r: Record<string, any>) => ({
    nama: String(r["nama_merchant"] ?? ""),
    storeId: String(r["store_id"] ?? ""),
  }));
}

/** Pengaturan logo header tampilan absensi. */
export async function getLogoSettings(): Promise<DoaLogoSettings> {
  const db = await admin();
  const { data } = await db
    .from("doa_pagi_logos")
    .select("data")
    .eq("id", "default")
    .maybeSingle();
  return normalizeDoaLogos((data as { data?: unknown } | null)?.data);
}

export async function saveLogoSettings(value: DoaLogoSettings) {
  const db = await admin();
  const { error } = await db.from("doa_pagi_logos").upsert(
    { id: "default", data: normalizeDoaLogos(value), updated_at: new Date().toISOString() },
    { onConflict: "id" },
  );
  if (error) throw new Error(error.message);
}

/** Simpan banyak sel absensi sekaligus (tombol simpan tampilan absensi). */
export async function upsertRecords(
  rows: {
    sectionId: string;
    pekerja: string;
    tanggal: string;
    qris: string;
    kehadiran: string;
  }[],
) {
  if (!rows.length) return 0;
  const db = await admin();
  const now = new Date().toISOString();
  const { error } = await db.from("doa_pagi_absensi").upsert(
    rows.map((r) => ({
      section_id: r.sectionId,
      pekerja: r.pekerja,
      tanggal: r.tanggal,
      qris: r.qris,
      kehadiran: r.kehadiran,
      updated_at: now,
    })),
    { onConflict: "section_id,pekerja,tanggal" },
  );
  if (error) throw new Error(error.message);
  return rows.length;
}

/** Riwayat absensi satu unit kerja pada rentang tanggal (laporan). */
export async function listRecordsRange(
  ukerId: string,
  from: string,
  to: string,
): Promise<{
  sections: DoaPagiSection[];
  records: DoaPagiRecord[];
  employees: { nama: string; jabatan: string; ukerId: string | null }[];
}> {
  const [sections, employees] = await Promise.all([listSections(ukerId), listEmployees(ukerId)]);
  if (!sections.length) return { sections, records: [], employees };
  const db = await admin();
  const { data, error } = await db
    .from("doa_pagi_absensi")
    .select("section_id,pekerja,tanggal,qris,kehadiran")
    .in(
      "section_id",
      sections.map((s) => s.id),
    )
    .gte("tanggal", from)
    .lte("tanggal", to)
    .order("tanggal", { ascending: true });
  if (error) throw new Error(error.message);
  const records = (data ?? []).map((r: Record<string, any>) => ({
    sectionId: String(r["section_id"]),
    pekerja: String(r["pekerja"] ?? ""),
    tanggal: String(r["tanggal"] ?? ""),
    qris: String(r["qris"] ?? ""),
    kehadiran: String(r["kehadiran"] ?? "Hadir"),
  }));
  return { sections, records, employees };
}
