/** Helper server-only untuk SuperIT Apps — Undian. */
import type {
  UndianHadiah,
  UndianKategori,
  UndianPemenang,
  UndianPeserta,
  UndianSettings,
} from "@/lib/undian-ui";

type Db = { from: (t: string) => any };
type Row = Record<string, any>;

async function admin(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Db;
}

export function toSettings(row: Row): UndianSettings {
  return {
    id: String(row["id"]),
    namaAcara: String(row["nama_acara"] ?? "Undian Doorprize"),
    namaKantor: String(row["nama_kantor"] ?? "BRI BO Pringsewu"),
    tanggal: String(row["tanggal"] ?? ""),
    themeColor: String(row["theme_color"] ?? "#1d6eb7"),
    logoUrl: row["logo_url"] ?? null,
    bgUrl: row["bg_url"] ?? null,
  };
}

const toKategori = (r: Row): UndianKategori => ({ id: String(r["id"]), nama: String(r["nama"]) });

const toHadiah = (r: Row): UndianHadiah => ({
  id: String(r["id"]),
  nama: String(r["nama"]),
  kategoriId: r["kategori_id"] ? String(r["kategori_id"]) : null,
  jumlah: Number(r["jumlah"] ?? 1),
});

const toPeserta = (r: Row): UndianPeserta => ({
  id: String(r["id"]),
  nip: String(r["nip"] ?? ""),
  nama: String(r["nama"] ?? ""),
  unitKerja: String(r["unit_kerja"] ?? "-"),
  kategoriAkses: String(r["kategori_akses"] ?? "all"),
  aktif: r["aktif"] !== false,
});

const toPemenang = (r: Row): UndianPemenang => ({
  id: String(r["id"]),
  pesertaId: r["peserta_id"] ? String(r["peserta_id"]) : null,
  namaPeserta: String(r["nama_peserta"] ?? ""),
  nip: String(r["nip"] ?? ""),
  unitKerja: String(r["unit_kerja"] ?? "-"),
  kategoriNama: String(r["kategori_nama"] ?? "-"),
  hadiahNama: String(r["hadiah_nama"] ?? "-"),
  createdAt: String(r["created_at"] ?? ""),
});

/* ------------------------------- otorisasi ------------------------------- */

export async function isPanelAdmin(userId: string) {
  const db = await admin();
  const { data } = await db.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  return roles.includes("superadmin") || roles.includes("it_admin");
}

export async function assertAdmin(userId: string) {
  if (!(await isPanelAdmin(userId))) throw new Error("Akses admin diperlukan.");
}

/* --------------------------------- event --------------------------------- */

export async function listEvents() {
  const db = await admin();
  const { data, error } = await db
    .from("undian_events")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const events = (data ?? []).map(toSettings);
  const counts: Record<string, { peserta: number; pemenang: number }> = {};
  for (const ev of events) counts[ev.id] = { peserta: 0, pemenang: 0 };
  const [{ data: ps }, { data: pm }] = await Promise.all([
    db.from("undian_peserta").select("event_id"),
    db.from("undian_pemenang").select("event_id"),
  ]);
  for (const r of (ps ?? []) as Row[]) {
    const c = counts[String(r["event_id"])];
    if (c) c.peserta += 1;
  }
  for (const r of (pm ?? []) as Row[]) {
    const c = counts[String(r["event_id"])];
    if (c) c.pemenang += 1;
  }
  return { events, counts };
}

export type SaveEventPayload = {
  id?: string;
  namaAcara: string;
  namaKantor: string;
  tanggal: string;
  themeColor: string;
  logoUrl: string | null;
  bgUrl: string | null;
};

export async function saveEvent(payload: SaveEventPayload, userId: string) {
  const db = await admin();
  const row: Record<string, unknown> = {
    nama_acara: payload.namaAcara,
    nama_kantor: payload.namaKantor,
    tanggal: payload.tanggal,
    theme_color: payload.themeColor,
    logo_url: payload.logoUrl,
    bg_url: payload.bgUrl,
    updated_at: new Date().toISOString(),
  };
  if (payload.id) {
    const { error } = await db.from("undian_events").update(row).eq("id", payload.id);
    if (error) throw new Error(error.message);
    return payload.id;
  }
  row["created_by"] = userId;
  const { data, error } = await db.from("undian_events").insert(row).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  return String(data?.id);
}

export async function deleteEvent(id: string) {
  const db = await admin();
  const { error } = await db.from("undian_events").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function eventDetail(eventId: string) {
  const db = await admin();
  const [ev, kat, had, pes, pem] = await Promise.all([
    db.from("undian_events").select("*").eq("id", eventId).maybeSingle(),
    db.from("undian_kategori").select("*").eq("event_id", eventId).order("created_at"),
    db.from("undian_hadiah").select("*").eq("event_id", eventId).order("created_at"),
    db.from("undian_peserta").select("*").eq("event_id", eventId).order("nama"),
    db
      .from("undian_pemenang")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true }),
  ]);
  if (!ev.data) throw new Error("Event undian tidak ditemukan.");
  return {
    event: toSettings(ev.data),
    kategori: (kat.data ?? []).map(toKategori),
    hadiah: (had.data ?? []).map(toHadiah),
    peserta: (pes.data ?? []).map(toPeserta),
    pemenang: (pem.data ?? []).map(toPemenang),
  };
}

/* ------------------------------ kategori/hadiah --------------------------- */

export async function addKategori(eventId: string, nama: string) {
  const db = await admin();
  const { error } = await db.from("undian_kategori").insert({ event_id: eventId, nama });
  if (error) throw new Error(error.message);
}

export async function deleteKategori(eventId: string, id: string) {
  const db = await admin();
  const { error } = await db
    .from("undian_kategori")
    .delete()
    .eq("id", id)
    .eq("event_id", eventId);
  if (error) throw new Error(error.message);
}

export async function addHadiah(
  eventId: string,
  input: { nama: string; kategoriId: string; jumlah: number },
) {
  const db = await admin();
  const { error } = await db.from("undian_hadiah").insert({
    event_id: eventId,
    kategori_id: input.kategoriId,
    nama: input.nama,
    jumlah: Math.max(1, Number(input.jumlah) || 1),
  });
  if (error) throw new Error(error.message);
}

export async function deleteHadiah(eventId: string, id: string) {
  const db = await admin();
  const { error } = await db.from("undian_hadiah").delete().eq("id", id).eq("event_id", eventId);
  if (error) throw new Error(error.message);
}

/* -------------------------------- peserta -------------------------------- */

export type PesertaInput = {
  nip: string;
  nama: string;
  unitKerja: string;
  kategoriAkses: string;
};

export async function addPeserta(eventId: string, input: PesertaInput) {
  const db = await admin();
  const { error } = await db.from("undian_peserta").insert({
    event_id: eventId,
    nip: input.nip,
    nama: input.nama,
    unit_kerja: input.unitKerja || "-",
    kategori_akses: input.kategoriAkses || "all",
    aktif: true,
  });
  if (error) throw new Error(error.message);
}

export async function importPeserta(eventId: string, rows: PesertaInput[]) {
  const db = await admin();
  const clean = (rows ?? []).filter((r) => r.nip && r.nama).slice(0, 5000);
  if (clean.length === 0) return { ok: false, count: 0 };
  const { error } = await db.from("undian_peserta").insert(
    clean.map((r) => ({
      event_id: eventId,
      nip: r.nip,
      nama: r.nama,
      unit_kerja: r.unitKerja || "-",
      kategori_akses: r.kategoriAkses || "all",
      aktif: true,
    })),
  );
  if (error) throw new Error(error.message);
  return { ok: true, count: clean.length };
}

/** Daftar pekerja untuk picker impor peserta (lengkap dengan jabatan). */
export type EmployeeOption = { nip: string; nama: string; unitKerja: string; jabatan: string };

export async function listEmployeeOptions(): Promise<EmployeeOption[]> {
  const db = await admin();
  const { data, error } = await db
    .from("employees")
    .select("nama,personal_number,uker:ukers(nama_uker),jabatan:job_titles(nama_jabatan)")
    .not("personal_number", "is", null)
    .order("nama", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[])
    .map((r) => ({
      nip: String(r["personal_number"] ?? "").trim(),
      nama: String(r["nama"] ?? "").trim(),
      unitKerja: String(r["uker"]?.["nama_uker"] ?? "-"),
      jabatan: String(r["jabatan"]?.["nama_jabatan"] ?? "-"),
    }))
    .filter((r) => r.nip && r.nama);
}

/** Impor peserta langsung dari Data Pekerja web app ini. */
export async function importPesertaFromEmployees(eventId: string, kategoriAkses: string) {
  const db = await admin();
  const options = await listEmployeeOptions();
  const existing = await db.from("undian_peserta").select("nip").eq("event_id", eventId);
  const already = new Set((existing.data ?? []).map((r: Row) => String(r["nip"])));
  const rows: PesertaInput[] = options
    .filter((o) => !already.has(o.nip))
    .map((o) => ({ nip: o.nip, nama: o.nama, unitKerja: o.unitKerja, kategoriAkses }));
  return importPeserta(eventId, rows);
}

export async function deletePeserta(eventId: string, id: string) {
  const db = await admin();
  const { error } = await db.from("undian_peserta").delete().eq("id", id).eq("event_id", eventId);
  if (error) throw new Error(error.message);
}

export async function deleteAllPeserta(eventId: string) {
  const db = await admin();
  const { error } = await db.from("undian_peserta").delete().eq("event_id", eventId);
  if (error) throw new Error(error.message);
}

/* -------------------------------- pemenang -------------------------------- */

export async function resetPemenang(eventId: string) {
  const db = await admin();
  const { error } = await db.from("undian_pemenang").delete().eq("event_id", eventId);
  if (error) throw new Error(error.message);
}

export async function deletePemenang(eventId: string, id: string) {
  const db = await admin();
  const { error } = await db.from("undian_pemenang").delete().eq("id", id).eq("event_id", eventId);
  if (error) throw new Error(error.message);
}

export type UndiInput = {
  eventId: string;
  kategoriId: string | null;
  hadiahId: string | null;
  jumlah: number;
};

export async function undiPemenangServer(input: UndiInput) {
  const db = await admin();
  const eventId = input.eventId;
  const jumlah = Math.min(Math.max(Number(input.jumlah) || 1, 1), 10);

  const [{ data: peserta }, { data: pemenang }] = await Promise.all([
    db
      .from("undian_peserta")
      .select("id, nip, nama, unit_kerja, kategori_akses, aktif")
      .eq("event_id", eventId),
    db.from("undian_pemenang").select("peserta_id, nip, hadiah_nama").eq("event_id", eventId),
  ]);

  let hadiahNama = "-";
  let kategoriId = input.kategoriId;
  if (input.hadiahId) {
    const { data: h } = await db
      .from("undian_hadiah")
      .select("nama, jumlah, kategori_id")
      .eq("id", input.hadiahId)
      .eq("event_id", eventId)
      .maybeSingle();
    if (!h) return { success: false as const, message: "Hadiah tidak ditemukan.", winners: [] };
    kategoriId = h["kategori_id"] ? String(h["kategori_id"]) : kategoriId;
    hadiahNama = String(h["nama"]);
    const terpakai = (pemenang ?? []).filter((p: Row) => p["hadiah_nama"] === h["nama"]).length;
    const sisaKuota = Math.max(0, (Number(h["jumlah"]) || 0) - terpakai);
    if (sisaKuota <= 0) {
      return {
        success: false as const,
        message: `Kuota hadiah "${h["nama"]}" sudah habis (${h["jumlah"]} pemenang).`,
        winners: [],
      };
    }
    if (jumlah > sisaKuota) {
      return {
        success: false as const,
        message: `Sisa kuota hadiah "${h["nama"]}" tinggal ${sisaKuota}. Kurangi jumlah pemenang.`,
        winners: [],
      };
    }
  }

  const wonIds = new Set((pemenang ?? []).map((p: Row) => p["peserta_id"]));
  const wonNips = new Set((pemenang ?? []).map((p: Row) => p["nip"]));

  const eligible = ((peserta ?? []) as Row[]).filter(
    (p) =>
      p["aktif"] !== false &&
      !wonIds.has(p["id"]) &&
      !wonNips.has(p["nip"]) &&
      (p["kategori_akses"] === "all" || p["kategori_akses"] === kategoriId),
  );

  if (eligible.length < jumlah) {
    return {
      success: false as const,
      message: `Peserta yang belum menang tersisa ${eligible.length} orang (butuh ${jumlah}).`,
      winners: [],
    };
  }

  const shuffled = [...eligible];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  const selected = shuffled.slice(0, jumlah);

  let kategoriNama = "Kategori Undian";
  if (kategoriId) {
    const { data: k } = await db
      .from("undian_kategori")
      .select("nama")
      .eq("id", kategoriId)
      .maybeSingle();
    if (k) kategoriNama = String(k["nama"]);
  }

  const rows = selected.map((p) => ({
    event_id: eventId,
    peserta_id: p["id"],
    nama_peserta: p["nama"],
    nip: p["nip"],
    unit_kerja: p["unit_kerja"] ?? "-",
    kategori_nama: kategoriNama,
    hadiah_nama: hadiahNama,
  }));

  const { data: inserted, error } = await db.from("undian_pemenang").insert(rows).select();
  if (error) throw new Error(error.message);

  return {
    success: true as const,
    message: "Undian berhasil",
    winners: (inserted ?? []).map(toPemenang),
  };
}
