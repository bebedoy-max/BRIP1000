import { createServerFn } from "@tanstack/react-start";

export type PhotoKind = "event" | "entity";

/**
 * Hapus baris foto dari database bila file-nya sudah tidak ada di Google Drive.
 * Dipanggil otomatis oleh galeri ketika sebuah thumbnail gagal dimuat, supaya
 * admin tidak perlu unggah ulang semua foto hanya karena beberapa file dihapus.
 */
export const purgeMissingPhoto = createServerFn({ method: "POST" })
  .inputValidator((input: { kind: PhotoKind; driveFileId: string }) => input)
  .handler(async ({ data }): Promise<{ removed: boolean; reason: string }> => {
    const fileId = String(data.driveFileId ?? "").trim();
    if (!fileId) return { removed: false, reason: "no-id" };

    const drive = await import("@/lib/drive.server");
    const acc = await drive.getActiveAccount();
    const token = await drive.accessToken(acc);

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,trashed`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    let missing = res.status === 404;
    if (res.ok) {
      const body = (await res.json()) as { trashed?: boolean };
      missing = body.trashed === true;
    } else if (!missing) {
      // error lain (mis. kuota/jaringan) — jangan hapus data
      return { removed: false, reason: `drive-${res.status}` };
    }

    if (!missing) return { removed: false, reason: "exists" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as { from: (t: string) => any };
    const table = data.kind === "entity" ? "entity_photos" : "event_photos";
    const { error } = await db.from(table).delete().eq("drive_file_id", fileId);
    if (error) throw new Error(error.message);
    return { removed: true, reason: "deleted" };
  });
