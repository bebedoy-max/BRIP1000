import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Membuat sesi unggah langsung (resumable) ke Google Drive untuk media
 * papan informasi. Byte file dikirim browser langsung ke Google, sehingga
 * ukuran video besar tidak terbatas oleh limit payload server.
 */
export const infoMediaUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fileName: string; mimeType: string }) => {
    if (!input.fileName?.trim()) throw new Error("Nama file wajib diisi.");
    if (!/^(image|video)\//.test(input.mimeType))
      throw new Error("File harus berupa gambar atau video.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/drive-guard.server");
    await assertAdmin(context.supabase, context.userId);
    const drive = await import("@/lib/drive.server");
    const acc = await drive.getActiveAccount();
    const token = await drive.accessToken(acc);
    const folderId = await drive.ensureEntityFolder(acc, token, "papan-informasi");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const res = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "content-type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": data.mimeType,
        },
        body: JSON.stringify({
          name: `papan-informasi_${stamp}_${data.fileName}`,
          parents: [folderId],
        }),
      },
    );
    if (!res.ok) throw new Error(`Drive resumable error [${res.status}]: ${await res.text()}`);
    const uploadUrl = res.headers.get("location");
    if (!uploadUrl) throw new Error("Google tidak mengirim URL unggah.");
    return { uploadUrl, folderId };
  });

/** Jadikan file hasil unggahan bisa dilihat lewat tautan (anyone reader). */
export const finalizeInfoMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fileId: string }) => {
    if (!input.fileId?.trim()) throw new Error("File ID wajib diisi.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/drive-guard.server");
    await assertAdmin(context.supabase, context.userId);
    const drive = await import("@/lib/drive.server");
    const acc = await drive.getActiveAccount();
    const token = await drive.accessToken(acc);
    await fetch(`https://www.googleapis.com/drive/v3/files/${data.fileId}/permissions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ role: "reader", type: "anyone" }),
    });
    return { ok: true };
  });

/** Hapus file media papan informasi dari Google Drive. */
export const deleteInfoMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fileId: string }) => input)
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/drive-guard.server");
    await assertAdmin(context.supabase, context.userId);
    const drive = await import("@/lib/drive.server");
    const acc = await drive.getActiveAccount();
    const token = await drive.accessToken(acc);
    await drive.deleteFromDrive(token, data.fileId);
    return { ok: true };
  });
