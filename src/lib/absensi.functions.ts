import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AbsensiDisplay, AbsensiSettings } from "@/lib/absensi-ui";

/** Publik: baca pengaturan satu absensi event lewat slug. */
export const getAbsensiEvent = createServerFn({ method: "GET" })
  .inputValidator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    const { getEventBySlug } = await import("@/lib/absensi.server");
    return getEventBySlug(data.slug);
  });

/** Publik: kirim absensi peserta. */
export const submitAbsensi = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      slug: string;
      nama?: string;
      personalNumber?: string;
      unitKerja?: string;
      noTelp?: string;
      fotoSelfie?: string | null;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { insertEntry } = await import("@/lib/absensi.server");
    await insertEntry(data);
    return { ok: true };
  });

export const listAbsensiEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listEventsFor } = await import("@/lib/absensi.server");
    return listEventsFor(context.userId);
  });

export const getAbsensiAdminEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertEventAdmin, getEventById, listEntries, listEventAdmins, isPanelAdmin } =
      await import("@/lib/absensi.server");
    await assertEventAdmin(context.userId, data.id);
    const [event, entries, admins, panel] = await Promise.all([
      getEventById(data.id),
      listEntries(data.id),
      listEventAdmins(data.id),
      isPanelAdmin(context.userId),
    ]);
    return { event, entries, admins, panel };
  });

export const saveAbsensiEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: Omit<AbsensiSettings, "id"> & { id?: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertCanCreate, assertEventAdmin, saveEvent } = await import("@/lib/absensi.server");
    if (data.id) await assertEventAdmin(context.userId, data.id);
    else await assertCanCreate(context.userId);
    const id = await saveEvent(data, context.userId);
    return { id };
  });

export const deleteAbsensiEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertCanCreate, deleteEvent } = await import("@/lib/absensi.server");
    await assertCanCreate(context.userId);
    await deleteEvent(data.id);
    return { ok: true };
  });

export const deleteAbsensiEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { eventId: string; entryId: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertEventAdmin, deleteEntry } = await import("@/lib/absensi.server");
    await assertEventAdmin(context.userId, data.eventId);
    await deleteEntry(data.eventId, data.entryId);
    return { ok: true };
  });

export const clearAbsensiEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { eventId: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertEventAdmin, clearEntries } = await import("@/lib/absensi.server");
    await assertEventAdmin(context.userId, data.eventId);
    await clearEntries(data.eventId);
    return { ok: true };
  });

export const addAbsensiAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { eventId: string; email: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertEventAdmin, addEventAdmin } = await import("@/lib/absensi.server");
    await assertEventAdmin(context.userId, data.eventId);
    await addEventAdmin(data.eventId, data.email);
    return { ok: true };
  });

export const removeAbsensiAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { eventId: string; id: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertEventAdmin, removeEventAdmin } = await import("@/lib/absensi.server");
    await assertEventAdmin(context.userId, data.eventId);
    await removeEventAdmin(data.eventId, data.id);
    return { ok: true };
  });

/** Default tampilan absensi event baru. */
export const getAbsensiDisplayDefaults = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { getDisplayDefaults } = await import("@/lib/absensi.server");
    const defaults = (await getDisplayDefaults()) as Partial<AbsensiDisplay> | null;
    return { defaults: defaults ?? null };
  });

export const saveAbsensiDisplayDefaults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: AbsensiDisplay) => data)
  .handler(async ({ data, context }) => {
    const { assertCanCreate, saveDisplayDefaults } = await import("@/lib/absensi.server");
    await assertCanCreate(context.userId);
    await saveDisplayDefaults(data as unknown as Record<string, unknown>);
    return { ok: true };
  });

/** Publik: saran nama pekerja untuk form absensi. */
export const searchAbsensiEmployees = createServerFn({ method: "POST" })
  .inputValidator((data: { term: string }) => data)
  .handler(async ({ data }) => {
    const { searchEmployeesByName } = await import("@/lib/absensi.server");
    return searchEmployeesByName(data.term);
  });
