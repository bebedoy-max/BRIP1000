import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DRIVE_SCOPES, isPhotoEntity, type PhotoEntity } from "@/lib/drive-entities";

export type DriveAccountView = {
  id: string;
  label: string;
  client_id: string;
  root_folder_name: string;
  root_folder_id: string | null;
  account_email: string | null;
  is_active: boolean;
  connected: boolean;
};

export const listDriveAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DriveAccountView[]> => {
    const { assertAdmin } = await import("@/lib/drive-guard.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as { from: (t: string) => any };
    const { data, error } = await db
      .from("drive_accounts")
      .select("id,label,client_id,root_folder_name,root_folder_id,account_email,is_active,refresh_token")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: Record<string, unknown>) => ({
      id: String(r["id"]),
      label: String(r["label"] ?? ""),
      client_id: String(r["client_id"] ?? ""),
      root_folder_name: String(r["root_folder_name"] ?? ""),
      root_folder_id: (r["root_folder_id"] as string) ?? null,
      account_email: (r["account_email"] as string) ?? null,
      is_active: !!r["is_active"],
      connected: !!r["refresh_token"],
    }));
  });

export const saveDriveAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string;
      label: string;
      client_id: string;
      client_secret?: string;
      root_folder_name: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/drive-guard.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as { from: (t: string) => any };
    const payload: Record<string, unknown> = {
      label: data.label.trim(),
      client_id: data.client_id.trim(),
      root_folder_name: data.root_folder_name.trim() || "SUPER IT DATA",
      updated_at: new Date().toISOString(),
    };
    if (data.client_secret && data.client_secret.trim()) {
      payload["client_secret"] = data.client_secret.trim();
    }
    if (data.id) {
      const { error } = await db.from("drive_accounts").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    if (!data.client_secret?.trim()) throw new Error("Client Secret wajib diisi.");
    const { data: row, error } = await db
      .from("drive_accounts")
      .insert({ ...payload, client_secret: data.client_secret.trim() })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: String(row.id) };
  });

export const deleteDriveAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/drive-guard.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as { from: (t: string) => any };
    const { error } = await db.from("drive_accounts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const activateDriveAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/drive-guard.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as { from: (t: string) => any };
    await db.from("drive_accounts").update({ is_active: false }).neq("id", data.id);
    const { error } = await db.from("drive_accounts").update({ is_active: true }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const driveAuthUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; origin: string }) => input)
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/drive-guard.server");
    await assertAdmin(context.supabase, context.userId);
    const { getAccount } = await import("@/lib/drive.server");
    const acc = await getAccount(data.id);
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", acc.client_id);
    url.searchParams.set("redirect_uri", `${data.origin}/api/public/google-drive/callback`);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", DRIVE_SCOPES);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", acc.id);
    return { url: url.toString() };
  });

export const listEntityPhotos = createServerFn({ method: "POST" })
  .inputValidator((input: { entity: string; entityId: string }) => input)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as { from: (t: string) => any };
    const { data: rows, error } = await db
      .from("entity_photos")
      .select("id,drive_file_id,file_name,view_url,created_at")
      .eq("entity_type", data.entity)
      .eq("entity_id", data.entityId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as {
      id: string;
      drive_file_id: string;
      file_name: string | null;
      view_url: string | null;
      created_at: string;
    }[];
  });

export const uploadEntityPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      entity: string;
      entityId: string;
      fileName: string;
      mimeType: string;
      base64: string;
      subfolder?: string | undefined;
    }) => {
      if (!isPhotoEntity(input.entity)) throw new Error("Jenis data tidak dikenal.");
      if (!input.mimeType.startsWith("image/")) throw new Error("File harus berupa gambar.");
      if (input.base64.length > 14_000_000) throw new Error("Ukuran foto maksimal ±10 MB.");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/drive-guard.server");
    await assertAdmin(context.supabase, context.userId);
    const drive = await import("@/lib/drive.server");
    const acc = await drive.getActiveAccount();
    const token = await drive.accessToken(acc);
    const folderId = await drive.ensureEntityFolder(acc, token, data.entity as PhotoEntity, data.subfolder);
    const binary = atob(data.base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = await drive.uploadToDrive({
      token,
      folderId,
      name: `${data.entity}_${data.entityId}_${stamp}_${data.fileName}`,
      mimeType: data.mimeType,
      bytes,
    });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as { from: (t: string) => any };
    const { error } = await db.from("entity_photos").insert({
      entity_type: data.entity,
      entity_id: data.entityId,
      drive_file_id: file.id,
      file_name: data.fileName,
      mime_type: data.mimeType,
      view_url: file.webViewLink ?? null,
      thumbnail_url: `https://drive.google.com/thumbnail?id=${file.id}&sz=w1000`,
      account_id: acc.id,
      uploaded_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { id: file.id };
  });

export const deleteEntityPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/drive-guard.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as { from: (t: string) => any };
    const { data: row } = await db
      .from("entity_photos")
      .select("drive_file_id,account_id")
      .eq("id", data.id)
      .maybeSingle();
    if (row?.drive_file_id) {
      try {
        const drive = await import("@/lib/drive.server");
        const acc = row.account_id
          ? await drive.getAccount(String(row.account_id))
          : await drive.getActiveAccount();
        const token = await drive.accessToken(acc);
        await drive.deleteFromDrive(token, String(row.drive_file_id));
      } catch (e) {
        console.error("Gagal menghapus file Drive", e);
      }
    }
    const { error } = await db.from("entity_photos").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
