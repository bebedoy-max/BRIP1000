import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { DoaLogoSettings, DoaPagiSection } from "@/lib/doa-pagi-ui";

/** Daftar unit kerja untuk popup pilihan. */
export const listDoaPagiUkers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { listUkers, listSections } = await import("@/lib/doa-pagi.server");
    const [ukers, sections] = await Promise.all([listUkers(), listSections()]);
    const counts: Record<string, number> = {};
    for (const s of sections) if (s.ukerId) counts[s.ukerId] = (counts[s.ukerId] ?? 0) + 1;
    return { ukers, counts };
  });

/** Tampilan absensi: bagian + absensi minggu kerja berjalan. */
export const getDoaPagiBoard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { ukerId: string; dates: string[] }) => data)
  .handler(async ({ data }) => {
    const { listSections, listRecords, listEmployees } = await import("@/lib/doa-pagi.server");
    const [sections, employees] = await Promise.all([
      listSections(data.ukerId),
      listEmployees(data.ukerId),
    ]);
    const records = await listRecords(
      sections.map((s) => s.id),
      data.dates,
    );
    return { sections, records, employees };
  });

/** Simpan satu sel absensi (QRIS + kehadiran). */
export const saveDoaPagiRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      sectionId: string;
      pekerja: string;
      tanggal: string;
      qris: string;
      kehadiran: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { upsertRecord } = await import("@/lib/doa-pagi.server");
    await upsertRecord(data);
    return { ok: true };
  });

/** Saran merchant QRIS (autocomplete). */
export const searchDoaPagiQris = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { term: string }) => data)
  .handler(async ({ data }) => {
    const { searchQrisMerchants } = await import("@/lib/doa-pagi.server");
    return searchQrisMerchants(data.term);
  });

/** Setting: data lengkap pengaturan bagian. */
export const getDoaPagiSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin, listUkers, listSections, listEmployees } = await import(
      "@/lib/doa-pagi.server"
    );
    await assertAdmin(context.userId);
    const [ukers, sections, employees] = await Promise.all([
      listUkers(),
      listSections(),
      listEmployees(),
    ]);
    return { ukers, sections, employees };
  });

export const saveDoaPagiSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Omit<DoaPagiSection, "id"> & { id?: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertAdmin, saveSection } = await import("@/lib/doa-pagi.server");
    await assertAdmin(context.userId);
    const id = await saveSection(data);
    return { id };
  });

export const deleteDoaPagiSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertAdmin, deleteSection } = await import("@/lib/doa-pagi.server");
    await assertAdmin(context.userId);
    await deleteSection(data.id);
    return { ok: true };
  });

/** Pengaturan logo header (dibaca tampilan absensi). */
export const getDoaPagiLogos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { getLogoSettings } = await import("@/lib/doa-pagi.server");
    return { logos: await getLogoSettings() };
  });

/** Simpan pengaturan logo (khusus admin). */
export const saveDoaPagiLogos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { logos: DoaLogoSettings }) => data)
  .handler(async ({ data, context }) => {
    const { assertAdmin, saveLogoSettings } = await import("@/lib/doa-pagi.server");
    await assertAdmin(context.userId);
    await saveLogoSettings(data.logos);
    return { ok: true };
  });

/** Simpan seluruh absensi pada tampilan (tombol Simpan Absensi). */
export const saveDoaPagiRecords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      rows: {
        sectionId: string;
        pekerja: string;
        tanggal: string;
        qris: string;
        kehadiran: string;
      }[];
    }) => data,
  )
  .handler(async ({ data }) => {
    const { upsertRecords } = await import("@/lib/doa-pagi.server");
    const saved = await upsertRecords(data.rows);
    return { saved };
  });

/** Laporan riwayat absensi per unit kerja pada rentang tanggal. */
export const getDoaPagiReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { ukerId: string; from: string; to: string }) => data)
  .handler(async ({ data }) => {
    const { listRecordsRange } = await import("@/lib/doa-pagi.server");
    return listRecordsRange(data.ukerId, data.from, data.to);
  });
