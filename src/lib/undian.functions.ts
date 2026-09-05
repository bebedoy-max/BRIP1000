import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listUndianEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin, listEvents, isPanelAdmin } = await import("@/lib/undian.server");
    await assertAdmin(context.userId);
    const res = await listEvents();
    return { ...res, panel: await isPanelAdmin(context.userId) };
  });

export const getUndianEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertAdmin, eventDetail } = await import("@/lib/undian.server");
    await assertAdmin(context.userId);
    return eventDetail(data.id);
  });

export const saveUndianEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      id?: string;
      namaAcara: string;
      namaKantor: string;
      tanggal: string;
      themeColor: string;
      logoUrl: string | null;
      bgUrl: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin, saveEvent } = await import("@/lib/undian.server");
    await assertAdmin(context.userId);
    return { id: await saveEvent(data, context.userId) };
  });

export const deleteUndianEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertAdmin, deleteEvent } = await import("@/lib/undian.server");
    await assertAdmin(context.userId);
    await deleteEvent(data.id);
    return { ok: true };
  });

export const addUndianKategori = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { eventId: string; nama: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertAdmin, addKategori } = await import("@/lib/undian.server");
    await assertAdmin(context.userId);
    await addKategori(data.eventId, data.nama);
    return { ok: true };
  });

export const deleteUndianKategori = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { eventId: string; id: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertAdmin, deleteKategori } = await import("@/lib/undian.server");
    await assertAdmin(context.userId);
    await deleteKategori(data.eventId, data.id);
    return { ok: true };
  });

export const addUndianHadiah = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { eventId: string; nama: string; kategoriId: string; jumlah: number }) => {
    if (!data.kategoriId) throw new Error("Kategori hadiah wajib dipilih.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { assertAdmin, addHadiah } = await import("@/lib/undian.server");
    await assertAdmin(context.userId);
    await addHadiah(data.eventId, {
      nama: data.nama,
      kategoriId: data.kategoriId,
      jumlah: data.jumlah,
    });
    return { ok: true };
  });

export const deleteUndianHadiah = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { eventId: string; id: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertAdmin, deleteHadiah } = await import("@/lib/undian.server");
    await assertAdmin(context.userId);
    await deleteHadiah(data.eventId, data.id);
    return { ok: true };
  });

export type UndianPesertaInput = {
  nip: string;
  nama: string;
  unitKerja: string;
  kategoriAkses: string;
};

export const addUndianPeserta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { eventId: string } & UndianPesertaInput) => data)
  .handler(async ({ data, context }) => {
    const { assertAdmin, addPeserta } = await import("@/lib/undian.server");
    await assertAdmin(context.userId);
    await addPeserta(data.eventId, data);
    return { ok: true };
  });

export const importUndianPeserta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { eventId: string; rows: UndianPesertaInput[] }) => data)
  .handler(async ({ data, context }) => {
    const { assertAdmin, importPeserta } = await import("@/lib/undian.server");
    await assertAdmin(context.userId);
    return importPeserta(data.eventId, data.rows);
  });

export const listUndianEmployeeOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin, listEmployeeOptions } = await import("@/lib/undian.server");
    await assertAdmin(context.userId);
    return listEmployeeOptions();
  });

export const importUndianPesertaPekerja = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { eventId: string; kategoriAkses: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertAdmin, importPesertaFromEmployees } = await import("@/lib/undian.server");
    await assertAdmin(context.userId);
    return importPesertaFromEmployees(data.eventId, data.kategoriAkses || "all");
  });

export const deleteUndianPeserta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { eventId: string; id: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertAdmin, deletePeserta } = await import("@/lib/undian.server");
    await assertAdmin(context.userId);
    await deletePeserta(data.eventId, data.id);
    return { ok: true };
  });

export const deleteAllUndianPeserta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { eventId: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertAdmin, deleteAllPeserta } = await import("@/lib/undian.server");
    await assertAdmin(context.userId);
    await deleteAllPeserta(data.eventId);
    return { ok: true };
  });

export const undiUndianPemenang = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { eventId: string; kategoriId: string | null; hadiahId: string | null; jumlah: number }) =>
      data,
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin, undiPemenangServer } = await import("@/lib/undian.server");
    await assertAdmin(context.userId);
    return undiPemenangServer(data);
  });

export const resetUndianPemenang = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { eventId: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertAdmin, resetPemenang } = await import("@/lib/undian.server");
    await assertAdmin(context.userId);
    await resetPemenang(data.eventId);
    return { ok: true };
  });

export const deleteUndianPemenang = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { eventId: string; id: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertAdmin, deletePemenang } = await import("@/lib/undian.server");
    await assertAdmin(context.userId);
    await deletePemenang(data.eventId, data.id);
    return { ok: true };
  });
