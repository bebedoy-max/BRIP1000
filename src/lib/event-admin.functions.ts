import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Ubah judul/deskripsi/tanggal event; folder Drive ikut diganti namanya. */
export const updateEventDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { id: string; nama_event: string; deskripsi?: string | null; tanggal_mulai?: string | null }) => {
      if (!input.id) throw new Error("Event tidak dikenal.");
      if (!input.nama_event?.trim()) throw new Error("Nama event wajib diisi.");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { assertEventAdmin } = await import("@/lib/event-guard.server");
    await assertEventAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as { from: (t: string) => any };

    const { data: before } = await db
      .from("events")
      .select("nama_event,drive_folder_id")
      .eq("id", data.id)
      .maybeSingle();

    const payload: Record<string, unknown> = {
      nama_event: data.nama_event.trim(),
      deskripsi: data.deskripsi?.trim() ? data.deskripsi.trim() : null,
    };
    if (data.tanggal_mulai !== undefined) {
      payload["tanggal_mulai"] = data.tanggal_mulai ? data.tanggal_mulai : null;
    }
    const { error } = await db.from("events").update(payload).eq("id", data.id);
    if (error) throw new Error(error.message);

    let folderRenamed = false;
    const oldName = String(before?.nama_event ?? "").trim();
    if (oldName && oldName !== data.nama_event.trim()) {
      try {
        const drive = await import("@/lib/drive.server");
        const acc = await drive.getActiveAccount();
        const token = await drive.accessToken(acc);
        const folderId =
          (before?.drive_folder_id as string | null) ??
          (await drive.ensureEntityFolder(acc, token, "event", oldName));
        const res = await fetch(
          `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(String(folderId))}`,
          {
            method: "PATCH",
            headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
            body: JSON.stringify({ name: data.nama_event.trim() }),
          },
        );
        folderRenamed = res.ok;
        if (res.ok && !before?.drive_folder_id) {
          await db.from("events").update({ drive_folder_id: folderId }).eq("id", data.id);
        }
      } catch (e) {
        console.error("Gagal mengganti nama folder Drive", e);
      }
    }
    return { ok: true, folderRenamed };
  });

/** Hapus foto event tertentu: file di Drive + barisnya di database. */
export const deleteEventPhotos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ids: string[] }) => {
    if (!Array.isArray(input.ids) || !input.ids.length) throw new Error("Pilih foto dulu.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { assertEventAdmin } = await import("@/lib/event-guard.server");
    await assertEventAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as { from: (t: string) => any };

    const { data: rows, error } = await db
      .from("event_photos")
      .select("id,drive_file_id")
      .in("id", data.ids);
    if (error) throw new Error(error.message);

    let driveDeleted = 0;
    try {
      const drive = await import("@/lib/drive.server");
      const acc = await drive.getActiveAccount();
      const token = await drive.accessToken(acc);
      for (const row of (rows ?? []) as { drive_file_id: string }[]) {
        try {
          await drive.deleteFromDrive(token, row.drive_file_id);
          driveDeleted += 1;
        } catch {
          /* file mungkin sudah tidak ada */
        }
      }
    } catch (e) {
      console.error("Drive tidak tersedia saat hapus foto event", e);
    }

    const { error: delErr } = await db.from("event_photos").delete().in("id", data.ids);
    if (delErr) throw new Error(delErr.message);
    return { ok: true, removed: data.ids.length, driveDeleted };
  });

/** Hapus event beserta seluruh foto (database + folder Google Drive). */
export const deleteEventFully = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input.id) throw new Error("Event tidak dikenal.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { assertEventAdmin } = await import("@/lib/event-guard.server");
    await assertEventAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as { from: (t: string) => any };

    const { data: ev } = await db
      .from("events")
      .select("nama_event,drive_folder_id")
      .eq("id", data.id)
      .maybeSingle();
    const { data: photos } = await db
      .from("event_photos")
      .select("drive_file_id")
      .eq("event_id", data.id);

    let driveDeleted = 0;
    let folderDeleted = false;
    try {
      const drive = await import("@/lib/drive.server");
      const acc = await drive.getActiveAccount();
      const token = await drive.accessToken(acc);
      for (const p of (photos ?? []) as { drive_file_id: string }[]) {
        try {
          await drive.deleteFromDrive(token, p.drive_file_id);
          driveDeleted += 1;
        } catch {
          /* abaikan */
        }
      }
      const folderId =
        (ev?.drive_folder_id as string | null) ??
        (ev?.nama_event
          ? await drive.ensureEntityFolder(acc, token, "event", String(ev.nama_event))
          : null);
      if (folderId) {
        const res = await fetch(
          `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(String(folderId))}`,
          { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
        );
        folderDeleted = res.ok || res.status === 404;
      }
    } catch (e) {
      console.error("Drive tidak tersedia saat hapus event", e);
    }

    await db.from("event_photos").delete().eq("event_id", data.id);
    const { error } = await db.from("events").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true, driveDeleted, folderDeleted };
  });
