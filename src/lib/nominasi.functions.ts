import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { NominasiBoard } from "@/lib/nominasi-ui";

export const listNominasiEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin, listEvents, isPanelAdmin } = await import("@/lib/nominasi.server");
    await assertAdmin(context.userId);
    return { events: await listEvents(), panel: await isPanelAdmin(context.userId) };
  });

export const getNominasiEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertAdmin, getEvent } = await import("@/lib/nominasi.server");
    await assertAdmin(context.userId);
    return getEvent(data.id);
  });

export const createNominasiEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { namaAcara: string; tanggal: string; unit: string; period: string }) => {
    if (data.namaAcara.trim().length < 3) throw new Error("Nama acara minimal 3 karakter.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { assertAdmin, createEvent } = await import("@/lib/nominasi.server");
    await assertAdmin(context.userId);
    return { id: await createEvent(data, context.userId) };
  });

export const saveNominasiEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { id: string; namaAcara?: string; tanggal?: string; data?: NominasiBoard }) => data,
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin, saveEvent } = await import("@/lib/nominasi.server");
    await assertAdmin(context.userId);
    return saveEvent(data);
  });

export const deleteNominasiEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { assertAdmin, deleteEvent } = await import("@/lib/nominasi.server");
    await assertAdmin(context.userId);
    return deleteEvent(data.id);
  });
