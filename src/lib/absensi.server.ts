/** Helper server-only untuk SuperIT Apps — Absensi Event. */
import type { AbsensiEntry, AbsensiFields, AbsensiSettings } from "@/lib/absensi-ui";
import { driveImageUrl } from "@/lib/drive-entities";

type Db = { from: (t: string) => any };

async function admin(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Db;
}

export type AbsensiEventRow = Record<string, any>;

const defaultFields: AbsensiFields = {
  nama: true,
  personalNumber: true,
  unitKerja: true,
  noTelp: true,
  fotoSelfie: true,
};

export function toSettings(row: AbsensiEventRow): AbsensiSettings {
  return {
    id: String(row["id"]),
    slug: String(row["slug"]),
    eventName: String(row["event_name"] ?? ""),
    officeName: String(row["office_name"] ?? ""),
    eventDate: String(row["event_date"] ?? ""),
    logo: row["logo"] ?? null,
    logoLeft: row["logo_left"] ?? null,
    logoRight: row["logo_right"] ?? null,
    logoLeftSize: Number(row["logo_left_size"] ?? 136),
    logoRightSize: Number(row["logo_right_size"] ?? 136),
    logoLeftTop: Number(row["logo_left_top"] ?? 14),
    logoRightTop: Number(row["logo_right_top"] ?? 14),
    background: row["background"] ?? null,
    cardBackground: row["card_background"] ?? null,
    themeColor: String(row["theme_color"] ?? "gold"),
    fields: { ...defaultFields, ...((row["fields"] as AbsensiFields) ?? {}) },
    unitKerjaList: (row["unit_kerja_list"] as string[]) ?? [],
    isOpen: row["is_open"] !== false,
  };
}

/** Level admin panel (superadmin / it_admin) boleh mengelola semua absensi event. */
export async function isPanelAdmin(userId: string) {
  const db = await admin();
  const { data } = await db.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  return roles.includes("superadmin") || roles.includes("it_admin");
}

/** Admin panel atau admin khusus event ini. */
export async function assertEventAdmin(userId: string, eventId: string) {
  if (await isPanelAdmin(userId)) return;
  const db = await admin();
  const { data } = await db
    .from("absensi_event_admins")
    .select("id")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Anda bukan admin absensi event ini.");
}

export async function assertCanCreate(userId: string) {
  if (!(await isPanelAdmin(userId))) throw new Error("Akses admin diperlukan.");
}

export async function listEventsFor(userId: string) {
  const db = await admin();
  const panel = await isPanelAdmin(userId);
  let ids: string[] | null = null;
  if (!panel) {
    const { data } = await db.from("absensi_event_admins").select("event_id").eq("user_id", userId);
    ids = (data ?? []).map((r: { event_id: string }) => r.event_id);
  }
  let q = db.from("absensi_events").select("*").order("created_at", { ascending: false });
  if (ids) {
    if (!ids.length) return { panel, events: [] as AbsensiSettings[], counts: {} as Record<string, number> };
    q = q.in("id", ids);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const events = (data ?? []).map(toSettings);

  const counts: Record<string, number> = {};
  for (const ev of events) {
    const { count } = await db
      .from("absensi_entries")
      .select("id", { count: "exact", head: true })
      .eq("event_id", ev.id);
    counts[ev.id] = count ?? 0;
  }
  return { panel, events, counts };
}

/** Daftar unit kerja diambil langsung dari database uker web app. */
export async function listUnitKerja(): Promise<string[]> {
  try {
    const db = await admin();
    const { data } = await db.from("ukers").select("nama_uker").order("nama_uker");
    const names = (data ?? [])
      .map((r: { nama_uker?: string | null }) => (r.nama_uker ?? "").trim())
      .filter(Boolean) as string[];
    return Array.from(new Set(names));
  } catch {
    return [];
  }
}

export async function getEventById(id: string) {
  const db = await admin();
  const { data, error } = await db.from("absensi_events").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Absensi event tidak ditemukan.");
  const settings = toSettings(data);
  return { ...settings, unitKerjaList: await listUnitKerja() };
}

export async function getEventBySlug(slug: string) {
  const db = await admin();
  const { data } = await db.from("absensi_events").select("*").eq("slug", slug).maybeSingle();
  if (!data) return null;
  const settings = toSettings(data);
  return { ...settings, unitKerjaList: await listUnitKerja() };
}

/** Default tampilan untuk absensi event baru. */
export async function getDisplayDefaults(): Promise<Record<string, unknown> | null> {
  try {
    const db = await admin();
    const { data } = await db
      .from("absensi_display_defaults")
      .select("data")
      .eq("id", "default")
      .maybeSingle();
    return (data?.data as Record<string, unknown>) ?? null;
  } catch {
    return null;
  }
}

export async function saveDisplayDefaults(payload: Record<string, unknown>) {
  const db = await admin();
  const { error } = await db
    .from("absensi_display_defaults")
    .upsert({ id: "default", data: payload, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export type SavePayload = Omit<AbsensiSettings, "id"> & { id?: string };

export async function saveEvent(payload: SavePayload, userId: string) {
  const db = await admin();
  const row: Record<string, unknown> = {
    slug: payload.slug,
    event_name: payload.eventName,
    office_name: payload.officeName,
    event_date: payload.eventDate,
    logo: payload.logo,
    logo_left: payload.logoLeft,
    logo_right: payload.logoRight,
    logo_left_size: payload.logoLeftSize,
    logo_right_size: payload.logoRightSize,
    logo_left_top: payload.logoLeftTop,
    logo_right_top: payload.logoRightTop,
    background: payload.background,
    card_background: payload.cardBackground,
    theme_color: payload.themeColor,
    fields: payload.fields,
    unit_kerja_list: payload.unitKerjaList,
    is_open: payload.isOpen,
    updated_at: new Date().toISOString(),
  };
  /** Kolom opsional (belum tentu ada di database lama) — dilepas bila ditolak. */
  const optional = ["logo_left_top", "logo_right_top"];
  const missingColumn = (msg?: string) =>
    !!msg && optional.some((c) => msg.includes(c)) && /column|schema cache/i.test(msg);
  const stripped = () => {
    const r = { ...row };
    for (const c of optional) delete r[c];
    return r;
  };

  if (payload.id) {
    let { error } = await db.from("absensi_events").update(row).eq("id", payload.id);
    if (error && missingColumn(error.message)) {
      ({ error } = await db.from("absensi_events").update(stripped()).eq("id", payload.id));
    }
    if (error) throw new Error(error.message);
    return payload.id;
  }
  row["created_by"] = userId;
  let { data, error } = await db.from("absensi_events").insert(row).select("id").maybeSingle();
  if (error && missingColumn(error.message)) {
    ({ data, error } = await db
      .from("absensi_events")
      .insert({ ...stripped(), created_by: userId })
      .select("id")
      .maybeSingle());
  }
  if (error) throw new Error(error.message);
  return String(data?.id);
}


export async function deleteEvent(id: string) {
  const db = await admin();
  const entries = await listEntries(id);
  const fileIds = entries.map((e) => e.photoFileId).filter(Boolean) as string[];
  if (fileIds.length) {
    try {
      const { getActiveAccount, accessToken, deleteFromDrive } = await import("@/lib/drive.server");
      const acc = await getActiveAccount();
      const token = await accessToken(acc);
      for (const fid of fileIds) await deleteFromDrive(token, fid);
    } catch (err) {
      console.error("Gagal menghapus foto absensi di Drive:", err);
    }
  }
  const { error } = await db.from("absensi_events").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

type EntryRow = AbsensiEntry & { photoFileId: string | null };

export async function listEntries(eventId: string): Promise<EntryRow[]> {
  const db = await admin();
  const { data, error } = await db
    .from("absensi_entries")
    .select("*")
    .eq("event_id", eventId)
    .order("submitted_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: Record<string, any>) => ({
    id: String(r["id"]),
    submittedAt: String(r["submitted_at"]),
    nama: r["nama"] ?? null,
    personalNumber: r["personal_number"] ?? null,
    unitKerja: r["unit_kerja"] ?? null,
    noTelp: r["no_telp"] ?? null,
    photoUrl: r["photo_url"] ?? null,
    photoThumbnailUrl: r["photo_thumbnail_url"] ?? null,
    photoFileId: r["photo_file_id"] ?? null,
  }));
}

export async function deleteEntry(eventId: string, entryId: string) {
  const db = await admin();
  const { data } = await db
    .from("absensi_entries")
    .select("photo_file_id")
    .eq("id", entryId)
    .eq("event_id", eventId)
    .maybeSingle();
  await removeDriveFiles([data?.photo_file_id].filter(Boolean) as string[]);
  const { error } = await db.from("absensi_entries").delete().eq("id", entryId).eq("event_id", eventId);
  if (error) throw new Error(error.message);
}

export async function clearEntries(eventId: string) {
  const db = await admin();
  const entries = await listEntries(eventId);
  await removeDriveFiles(entries.map((e) => e.photoFileId).filter(Boolean) as string[]);
  const { error } = await db.from("absensi_entries").delete().eq("event_id", eventId);
  if (error) throw new Error(error.message);
}

async function removeDriveFiles(fileIds: string[]) {
  if (!fileIds.length) return;
  try {
    const { getActiveAccount, accessToken, deleteFromDrive } = await import("@/lib/drive.server");
    const acc = await getActiveAccount();
    const token = await accessToken(acc);
    for (const fid of fileIds) await deleteFromDrive(token, fid);
  } catch (err) {
    console.error("Gagal menghapus foto absensi di Drive:", err);
  }
}

export type NewEntry = {
  slug: string;
  nama?: string;
  personalNumber?: string;
  unitKerja?: string;
  noTelp?: string;
  fotoSelfie?: string | null;
};

/** Simpan selfie ke Google Drive milik panel (folder Foto Absensi/<nama event>). */
async function storePhoto(dataUrl: string, personName: string, eventName: string) {
  const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Format foto tidak dikenali.");
  const { getActiveAccount, accessToken, ensureEntityFolder, uploadToDrive } = await import(
    "@/lib/drive.server"
  );
  const acc = await getActiveAccount();
  const token = await accessToken(acc);
  const folderId = await ensureEntityFolder(acc, token, "absensi", eventName || "Absensi");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const name = `${personName || "peserta"}-${stamp}.jpg`.replace(/[\\/]/g, "-");
  const bytes = Uint8Array.from(atob(match[2]!), (c) => c.charCodeAt(0));
  const file = await uploadToDrive({
    token,
    folderId,
    name,
    mimeType: match[1]!,
    bytes,
  });
  return {
    photo_file_id: file.id,
    photo_url: driveImageUrl(file.id, 1400),
    photo_thumbnail_url: driveImageUrl(file.id, 300),
  };
}

export async function insertEntry(record: NewEntry) {
  const event = await getEventBySlug(record.slug);
  if (!event) throw new Error("Absensi event tidak ditemukan.");
  if (!event.isOpen) throw new Error("Absensi event ini sudah ditutup.");

  const db = await admin();
  let photo: Record<string, string | null> = {
    photo_file_id: null,
    photo_url: null,
    photo_thumbnail_url: null,
  };
  if (record.fotoSelfie) {
    photo = await storePhoto(record.fotoSelfie, record.nama ?? "", event.eventName);
  }
  const { error } = await db.from("absensi_entries").insert({
    event_id: event.id,
    nama: record.nama ?? null,
    personal_number: record.personalNumber ?? null,
    unit_kerja: record.unitKerja ?? null,
    no_telp: record.noTelp ?? null,
    ...photo,
  });
  if (error) throw new Error(error.message);
}

export type EventAdminView = { id: string; userId: string; email: string | null };

export async function listEventAdmins(eventId: string): Promise<EventAdminView[]> {
  const db = await admin();
  const { data, error } = await db
    .from("absensi_event_admins")
    .select("id,user_id,email")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: Record<string, any>) => ({
    id: String(r["id"]),
    userId: String(r["user_id"]),
    email: r["email"] ?? null,
  }));
}

export async function addEventAdmin(eventId: string, email: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const clean = email.trim().toLowerCase();
  const { data: list } = await (supabaseAdmin as any).auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = (list?.users ?? []).find(
    (u: { email?: string }) => (u.email ?? "").toLowerCase() === clean,
  );
  if (!user) throw new Error("User dengan email tersebut belum terdaftar di panel.");
  const db = await admin();
  const { error } = await db
    .from("absensi_event_admins")
    .upsert(
      { event_id: eventId, user_id: user.id, email: clean },
      { onConflict: "event_id,user_id" },
    );
  if (error) throw new Error(error.message);
}

export async function removeEventAdmin(eventId: string, id: string) {
  const db = await admin();
  const { error } = await db.from("absensi_event_admins").delete().eq("id", id).eq("event_id", eventId);
  if (error) throw new Error(error.message);
}

/** Cari pekerja untuk saran nama pada form absensi publik (maks 5). */
export async function searchEmployeesByName(term: string) {
  const q = term.trim();
  if (q.length < 2) return [];
  try {
    const db = await admin();
    const { data } = await db
      .from("employees")
      .select("nama,personal_number,uker:ukers(nama_uker)")
      .ilike("nama", `%${q}%`)
      .order("nama", { ascending: true })
      .limit(5);
    return (data ?? []).map((r: Record<string, any>) => ({
      nama: String(r["nama"] ?? ""),
      personalNumber: r["personal_number"] ? String(r["personal_number"]) : "",
      unitKerja: String(r["uker"]?.["nama_uker"] ?? ""),
    }));
  } catch {
    return [];
  }
}
