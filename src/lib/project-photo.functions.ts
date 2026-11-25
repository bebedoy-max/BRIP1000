import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Unggah gambar project ke Google Drive, kembalikan ID file untuk kolom foto_url. */
export const uploadProjectImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fileName: string; mimeType: string; base64: string }) => {
    if (!input.mimeType.startsWith("image/")) throw new Error("File harus berupa gambar.");
    if (input.base64.length > 14_000_000) throw new Error("Ukuran gambar maksimal ±10 MB.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/drive-guard.server");
    await assertAdmin(context.supabase, context.userId);
    const drive = await import("@/lib/drive.server");
    const acc = await drive.getActiveAccount();
    const token = await drive.accessToken(acc);
    const folderId = await drive.ensureEntityFolder(acc, token, "project");
    const binary = atob(data.base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = await drive.uploadToDrive({
      token,
      folderId,
      name: `project_${stamp}_${data.fileName}`,
      mimeType: data.mimeType,
      bytes,
    });
    return { id: file.id };
  });

/** Upload langsung langkah 1: sesi resumable Drive untuk gambar project. */
export const startProjectImageUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fileName: string; mimeType: string; size: number }) => {
    if (!input.mimeType.startsWith("image/")) throw new Error("File harus berupa gambar.");
    if (!(input.size > 0) || input.size > 25 * 1024 * 1024)
      throw new Error("Ukuran gambar maksimal 25 MB.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/drive-guard.server");
    await assertAdmin(context.supabase, context.userId);
    const drive = await import("@/lib/drive.server");
    const acc = await drive.getActiveAccount();
    const token = await drive.accessToken(acc);
    const folderId = await drive.ensureEntityFolder(acc, token, "project");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const uploadUrl = await drive.createResumableSession({
      token,
      folderId,
      name: `project_${stamp}_${data.fileName}`,
      mimeType: data.mimeType,
      size: data.size,
      origin: drive.requestOrigin(),
    });
    return { uploadUrl };
  });

/** Upload langsung langkah 2: cek file berada di folder project. */
export const finishProjectImageUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fileId: string }) => {
    if (!/^[\w-]{10,200}$/.test(input.fileId)) throw new Error("ID file tidak valid.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/drive-guard.server");
    await assertAdmin(context.supabase, context.userId);
    const drive = await import("@/lib/drive.server");
    const acc = await drive.getActiveAccount();
    const token = await drive.accessToken(acc);
    const folderId = await drive.ensureEntityFolder(acc, token, "project");
    const file = await drive.finalizeDirectUpload(token, data.fileId, folderId);
    return { id: file.id };
  });
