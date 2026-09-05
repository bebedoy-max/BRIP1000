// Helper server-only untuk Google Drive (tidak boleh diimpor dari browser).
import { photoEntities, type PhotoEntity } from "@/lib/drive-entities";

export type DriveAccount = {
  id: string;
  label: string;
  client_id: string;
  client_secret: string;
  root_folder_name: string;
  root_folder_id: string | null;
  refresh_token: string | null;
  account_email: string | null;
  is_active: boolean;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as {
    from: (t: string) => any;
  };
}

export async function getActiveAccount(): Promise<DriveAccount> {
  const db = await admin();
  const { data, error } = await db
    .from("drive_accounts")
    .select("*")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Belum ada akun Google Drive aktif. Atur di menu Google Drive.");
  if (!data.refresh_token) throw new Error("Akun Google Drive aktif belum terhubung (login Google).");
  return data as DriveAccount;
}

export async function getAccount(id: string): Promise<DriveAccount> {
  const db = await admin();
  const { data, error } = await db.from("drive_accounts").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Akun Google Drive tidak ditemukan.");
  return data as DriveAccount;
}

/** Tukar refresh token jadi access token. */
export async function accessToken(acc: DriveAccount): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: acc.client_id,
      client_secret: acc.client_secret,
      refresh_token: acc.refresh_token ?? "",
      grant_type: "refresh_token",
    }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Google token error [${res.status}]: ${body}`);
  return (JSON.parse(body) as { access_token: string }).access_token;
}

async function findOrCreateFolder(token: string, name: string, parent?: string) {
  const q = [
    "mimeType='application/vnd.google-apps.folder'",
    "trashed=false",
    `name='${name.replace(/'/g, "\\'")}'`,
    parent ? `'${parent}' in parents` : "'root' in parents",
  ].join(" and ");
  const listRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const listBody = await listRes.text();
  if (!listRes.ok) throw new Error(`Drive list error [${listRes.status}]: ${listBody}`);
  const found = (JSON.parse(listBody) as { files?: { id: string }[] }).files?.[0];
  if (found) return found.id;

  const createRes = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parent ? [parent] : undefined,
    }),
  });
  const createBody = await createRes.text();
  if (!createRes.ok) throw new Error(`Drive folder error [${createRes.status}]: ${createBody}`);
  return (JSON.parse(createBody) as { id: string }).id;
}

/** Pastikan folder root + subfolder per menu tersedia, kembalikan id subfolder. */
export async function ensureEntityFolder(
  acc: DriveAccount,
  token: string,
  entity: PhotoEntity,
  subfolder?: string,
) {
  const rootId = acc.root_folder_id ?? (await findOrCreateFolder(token, acc.root_folder_name));
  if (!acc.root_folder_id) {
    const db = await admin();
    await db.from("drive_accounts").update({ root_folder_id: rootId }).eq("id", acc.id);
  }
  const entityFolder = await findOrCreateFolder(token, photoEntities[entity].folder, rootId);
  const sub = subfolder?.trim();
  if (!sub) return entityFolder;
  return findOrCreateFolder(token, sub, entityFolder);
}

/** Unggah file ke Drive dan jadikan bisa dilihat lewat tautan. */
export async function uploadToDrive(opts: {
  token: string;
  folderId: string;
  name: string;
  mimeType: string;
  bytes: Uint8Array;
}) {
  const boundary = `bnd${Math.random().toString(36).slice(2)}`;
  const meta = JSON.stringify({ name: opts.name, parents: [opts.folderId] });
  const enc = new TextEncoder();
  const head = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${opts.mimeType}\r\n\r\n`,
  );
  const tail = enc.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(head.length + opts.bytes.length + tail.length);
  body.set(head, 0);
  body.set(opts.bytes, head.length);
  body.set(tail, head.length + opts.bytes.length);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.token}`,
        "content-type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`Drive upload error [${res.status}]: ${text}`);
  const file = JSON.parse(text) as { id: string; name: string; mimeType: string; webViewLink?: string };

  await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}/permissions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${opts.token}`, "content-type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });

  return file;
}

export async function deleteFromDrive(token: string, fileId: string) {
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}
