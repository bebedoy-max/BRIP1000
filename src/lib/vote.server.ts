/** Helper server-only untuk SuperIT Apps — Vote. */
import {
  defaultVoteCategories,
  type VoteCategory,
  type VoteNominee,
  type VoteResultRow,
  type VoteSettings,
  type VoteVoterStats,
} from "@/lib/vote-ui";

type Db = { from: (t: string) => any };

async function admin(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Db;
}

type Row = Record<string, any>;

export function toVoteSettings(row: Row): VoteSettings {
  const cats = Array.isArray(row["categories"]) ? (row["categories"] as VoteCategory[]) : [];
  return {
    id: String(row["id"]),
    slug: String(row["slug"]),
    title: String(row["title"] ?? ""),
    subtitle: String(row["subtitle"] ?? ""),
    eyebrow: String(row["eyebrow"] ?? "Program Apresiasi"),
    showcaseNote: String(row["showcase_note"] ?? "Dashboard pengumuman pemenang"),
    location: String(row["location"] ?? ""),
    eventDate: String(row["event_date"] ?? ""),
    accent: String(row["accent"] ?? "#a855f7"),
    logo: row["logo"] ?? null,
    categories: cats.length ? cats : defaultVoteCategories,
    isHold: row["is_hold"] === true,
    isClosed: row["is_closed"] === true,
  };
}

function toNominee(row: Row): VoteNominee {
  return {
    id: String(row["id"]),
    category: String(row["category"]),
    nama: String(row["nama"]),
    jabatan: row["jabatan"] ?? null,
    uker: row["uker"] ?? null,
    personalNumber: row["personal_number"] ?? null,
    foto: row["foto"] ?? null,
    sortOrder: Number(row["sort_order"] ?? 0),
  };
}

/* ------------------------------- otorisasi ------------------------------- */

export async function isPanelAdmin(userId: string) {
  const db = await admin();
  const { data } = await db.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  return roles.includes("superadmin") || roles.includes("it_admin");
}

export async function assertEventAdmin(userId: string, eventId: string) {
  if (await isPanelAdmin(userId)) return;
  const db = await admin();
  const { data } = await db
    .from("vote_event_admins")
    .select("id")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Anda bukan admin vote event ini.");
}

export async function assertCanCreate(userId: string) {
  if (!(await isPanelAdmin(userId))) throw new Error("Akses admin diperlukan.");
}

/* ------------------------------ event CRUD ------------------------------- */

export async function listEventsFor(userId: string) {
  const db = await admin();
  const panel = await isPanelAdmin(userId);
  let ids: string[] | null = null;
  if (!panel) {
    const { data } = await db.from("vote_event_admins").select("event_id").eq("user_id", userId);
    ids = (data ?? []).map((r: { event_id: string }) => r.event_id);
  }
  let q = db.from("vote_events").select("*").order("created_at", { ascending: false });
  if (ids) {
    if (!ids.length) return { panel, events: [] as VoteSettings[], counts: {} as Record<string, number> };
    q = q.in("id", ids);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const events = (data ?? []).map(toVoteSettings);

  const counts: Record<string, number> = {};
  for (const ev of events) {
    const { count } = await db
      .from("vote_ballots")
      .select("id", { count: "exact", head: true })
      .eq("event_id", ev.id);
    counts[ev.id] = count ?? 0;
  }
  return { panel, events, counts };
}

export async function getEventById(id: string) {
  const db = await admin();
  const { data, error } = await db.from("vote_events").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Vote event tidak ditemukan.");
  return toVoteSettings(data);
}

export async function getEventBySlug(slug: string) {
  const db = await admin();
  const { data } = await db.from("vote_events").select("*").eq("slug", slug).maybeSingle();
  return data ? toVoteSettings(data) : null;
}

export type SaveVotePayload = Omit<VoteSettings, "id"> & { id?: string };

export async function saveEvent(payload: SaveVotePayload, userId: string) {
  const db = await admin();
  const row: Record<string, unknown> = {
    slug: payload.slug,
    title: payload.title,
    subtitle: payload.subtitle,
    eyebrow: payload.eyebrow,
    showcase_note: payload.showcaseNote,
    location: payload.location,
    event_date: payload.eventDate,
    accent: payload.accent,
    logo: payload.logo,
    categories: payload.categories,
    is_hold: payload.isHold,
    is_closed: payload.isClosed,
    updated_at: new Date().toISOString(),
  };
  const missingCol = (msg: string) => /showcase_note|location/i.test(msg);
  if (payload.id) {
    let { error } = await db.from("vote_events").update(row).eq("id", payload.id);
    if (error && missingCol(error.message)) {
      delete row["showcase_note"];
      delete row["location"];
      ({ error } = await db.from("vote_events").update(row).eq("id", payload.id));
    }
    if (error) throw new Error(error.message);
    return payload.id;
  }
  row["created_by"] = userId;
  let res = await db.from("vote_events").insert(row).select("id").maybeSingle();
  if (res.error && missingCol(res.error.message)) {
    delete row["showcase_note"];
    delete row["location"];
    res = await db.from("vote_events").insert(row).select("id").maybeSingle();
  }
  if (res.error) throw new Error(res.error.message);
  return String(res.data?.id);
}

export async function deleteEvent(id: string) {
  const db = await admin();
  const { error } = await db.from("vote_events").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* ------------------------------- nominasi -------------------------------- */

export async function listNominees(eventId: string): Promise<VoteNominee[]> {
  const db = await admin();
  const { data, error } = await db
    .from("vote_nominees")
    .select("*")
    .eq("event_id", eventId)
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toNominee);
}

export type NomineeInput = {
  id?: string;
  eventId: string;
  category: string;
  nama: string;
  jabatan?: string | null;
  uker?: string | null;
  personalNumber?: string | null;
  foto?: string | null;
  sortOrder?: number;
};

export async function saveNominee(input: NomineeInput) {
  const db = await admin();
  const row: Record<string, unknown> = {
    event_id: input.eventId,
    category: input.category,
    nama: input.nama,
    jabatan: input.jabatan ?? null,
    uker: input.uker ?? null,
    personal_number: input.personalNumber ?? null,
    foto: input.foto ?? null,
    sort_order: input.sortOrder ?? 0,
  };
  if (input.id) {
    const { error } = await db
      .from("vote_nominees")
      .update(row)
      .eq("id", input.id)
      .eq("event_id", input.eventId);
    if (error) throw new Error(error.message);
    return input.id;
  }
  const { data, error } = await db.from("vote_nominees").insert(row).select("id").maybeSingle();
  if (error) throw new Error(error.message);
  return String(data?.id);
}

export async function deleteNominee(eventId: string, id: string) {
  const db = await admin();
  const { error } = await db.from("vote_nominees").delete().eq("id", id).eq("event_id", eventId);
  if (error) throw new Error(error.message);
}

/* --------------------------------- admin --------------------------------- */

export async function listEventAdmins(eventId: string) {
  const db = await admin();
  const { data } = await db
    .from("vote_event_admins")
    .select("id,user_id,email")
    .eq("event_id", eventId);
  return (data ?? []).map((r: Row) => ({
    id: String(r["id"]),
    userId: String(r["user_id"]),
    email: (r["email"] as string | null) ?? null,
  }));
}

export async function addEventAdmin(eventId: string, email: string) {
  const db = await admin();
  const target = email.trim().toLowerCase();
  const { data } = await db.from("profiles").select("id,email").ilike("email", target).maybeSingle();
  if (!data) throw new Error("Pengguna dengan email tersebut belum terdaftar di panel.");
  const { error } = await db
    .from("vote_event_admins")
    .insert({ event_id: eventId, user_id: data["id"], email: data["email"] ?? target });
  if (error && !/duplicate|unique/i.test(error.message)) throw new Error(error.message);
}

export async function removeEventAdmin(eventId: string, id: string) {
  const db = await admin();
  const { error } = await db.from("vote_event_admins").delete().eq("id", id).eq("event_id", eventId);
  if (error) throw new Error(error.message);
}

/* --------------------------------- suara --------------------------------- */

export async function listBallots(eventId: string) {
  const db = await admin();
  const { data, error } = await db
    .from("vote_ballots")
    .select("personal_number,category,nominee,created_at")
    .eq("event_id", eventId);
  if (error) throw new Error(error.message);
  return (data ?? []) as Row[];
}

export async function voteResults(eventId: string): Promise<VoteResultRow[]> {
  const rows = await listBallots(eventId);
  const map = new Map<string, VoteResultRow>();
  for (const r of rows) {
    const key = `${r["category"]}|${r["nominee"]}`;
    const cur = map.get(key);
    if (cur) cur.total += 1;
    else map.set(key, { category: String(r["category"]), nominee: String(r["nominee"]), total: 1 });
  }
  return [...map.values()].sort((a, b) => a.category.localeCompare(b.category) || b.total - a.total);
}

/** Pemilih sah = seluruh Personal Number pada Data Pekerja. */
export async function voterStats(eventId: string): Promise<VoteVoterStats> {
  const db = await admin();
  const { data } = await db
    .from("employees")
    .select("personal_number")
    .not("personal_number", "is", null);
  const all = new Set(
    (data ?? [])
      .map((r: Row) => String(r["personal_number"] ?? "").trim())
      .filter((v: string) => v.length > 0),
  );
  const rows = await listBallots(eventId);
  const voted = new Set(rows.map((r) => String(r["personal_number"])));
  const votedCount = [...voted].filter((pn) => all.has(pn)).length;
  return {
    totalVoters: all.size,
    votedCount,
    notVotedCount: Math.max(0, all.size - votedCount),
  };
}

export async function resetVotes(eventId: string) {
  const db = await admin();
  const { error } = await db.from("vote_ballots").delete().eq("event_id", eventId);
  if (error) throw new Error(error.message);
}

export async function setHold(eventId: string, hold: boolean) {
  const db = await admin();
  const { error } = await db
    .from("vote_events")
    .update({ is_hold: hold, updated_at: new Date().toISOString() })
    .eq("id", eventId);
  if (error) throw new Error(error.message);
}

export async function setClosed(eventId: string, closed: boolean) {
  const db = await admin();
  const { error } = await db
    .from("vote_events")
    .update({ is_closed: closed, updated_at: new Date().toISOString() })
    .eq("id", eventId);
  if (error) throw new Error(error.message);
}

/* ------------------------------ sisi publik ------------------------------ */

/** Status ringkas untuk halaman publik (hold + closed). */
export async function publicStatus(slug: string) {
  const ev = await getEventBySlug(slug);
  if (!ev) return null;
  return { hold: ev.isHold, closed: ev.isClosed };
}

async function employeeByPn(pn: string) {
  const db = await admin();
  const { data } = await db
    .from("employees")
    .select("nama,personal_number")
    .eq("personal_number", pn)
    .maybeSingle();
  return data as Row | null;
}

export type VoterStatus =
  | { valid: false; reason: "format" | "not_found" | "event" }
  | { valid: true; nama: string | null; votes: { category: string; nominee: string }[] };

export async function voterStatus(slug: string, pn: string): Promise<VoterStatus> {
  const value = pn.trim();
  if (!/^\d{6,10}$/.test(value)) return { valid: false, reason: "format" };
  const ev = await getEventBySlug(slug);
  if (!ev) return { valid: false, reason: "event" };
  const emp = await employeeByPn(value);
  if (!emp) return { valid: false, reason: "not_found" };
  const db = await admin();
  const { data } = await db
    .from("vote_ballots")
    .select("category,nominee")
    .eq("event_id", ev.id)
    .eq("personal_number", value);
  return {
    valid: true,
    nama: (emp["nama"] as string) ?? null,
    votes: (data ?? []).map((r: Row) => ({
      category: String(r["category"]),
      nominee: String(r["nominee"]),
    })),
  };
}

export type CastResult =
  | { ok: true }
  | { ok: false; reason: "hold" | "closed" | "format" | "not_found" | "invalid" | "already_voted" | "event" };

export async function castVote(
  slug: string,
  pn: string,
  category: string,
  nominee: string,
): Promise<CastResult> {
  const value = pn.trim();
  if (!/^\d{6,10}$/.test(value)) return { ok: false, reason: "format" };
  const ev = await getEventBySlug(slug);
  if (!ev) return { ok: false, reason: "event" };
  if (ev.isClosed) return { ok: false, reason: "closed" };
  if (ev.isHold) return { ok: false, reason: "hold" };
  if (!category.trim() || !nominee.trim()) return { ok: false, reason: "invalid" };
  if (!(await employeeByPn(value))) return { ok: false, reason: "not_found" };

  const db = await admin();
  const { error } = await db
    .from("vote_ballots")
    .insert({ event_id: ev.id, personal_number: value, category, nominee });
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return { ok: false, reason: "already_voted" };
    throw new Error(error.message);
  }
  return { ok: true };
}

/** Data publik satu vote event: pengaturan + nominasi. */
export async function publicEvent(slug: string) {
  const ev = await getEventBySlug(slug);
  if (!ev) return null;
  const nominees = await listNominees(ev.id);
  return { settings: ev, nominees };
}

/** Data publik untuk dashboard pengumuman pemenang. */
export async function publicShowcase(slug: string) {
  const ev = await getEventBySlug(slug);
  if (!ev) return null;
  const [nominees, results, stats] = await Promise.all([
    listNominees(ev.id),
    voteResults(ev.id),
    voterStats(ev.id),
  ]);
  return { settings: ev, nominees, results, stats };
}

/* ---------------------- foto pekerja untuk nominasi ---------------------- */

export type WorkerPhoto = { url: string; label: string };

function driveThumbUrl(fileId: string, size = 800) {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`;
}

/** Kumpulan foto milik satu pekerja: foto master wajah + foto event yang terdeteksi. */
export async function workerPhotos(input: {
  workerId?: string | undefined;
  personalNumber?: string | undefined;
}): Promise<WorkerPhoto[]> {
  const db = await admin();
  const pn = (input.personalNumber ?? "").trim();
  let workerId = input.workerId ?? "";
  if (!workerId && pn) {
    const { data } = await db.from("employees").select("id").eq("personal_number", pn).maybeSingle();
    workerId = data ? String((data as Row)["id"]) : "";
  }
  const out: WorkerPhoto[] = [];

  let faceQuery = db.from("worker_faces").select("reference_photo_url,worker_id,personal_number");
  faceQuery = workerId ? faceQuery.eq("worker_id", workerId) : faceQuery.eq("personal_number", pn);
  const { data: faces } = await faceQuery;
  for (const f of ((faces ?? []) as Row[])) {
    const url = (f["reference_photo_url"] as string | null) ?? null;
    if (url) out.push({ url, label: "Foto master wajah" });
  }

  if (workerId) {
    const { data: photos } = await db
      .from("event_photos")
      .select("drive_file_id,file_name,processed_at")
      .contains("matched_worker_ids", [workerId])
      .order("processed_at", { ascending: false })
      .limit(60);
    const seen = new Set(out.map((o) => o.url));
    for (const p of ((photos ?? []) as Row[])) {
      const fid = String(p["drive_file_id"] ?? "");
      if (!fid) continue;
      const url = driveThumbUrl(fid);
      if (seen.has(url)) continue; // hindari foto ganda di picker
      seen.add(url);
      out.push({ url, label: "Foto event" });
    }
  }
  return out;
}

/** Unduh gambar di server lalu kembalikan sebagai data URL (hindari CORS saat crop). */
export async function imageAsDataUrl(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Foto tidak bisa diambil.");
  const type = res.headers.get("content-type") ?? "image/jpeg";
  const buf = new Uint8Array(await res.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 8192) {
    bin += String.fromCharCode(...buf.subarray(i, i + 8192));
  }
  return `data:${type};base64,${btoa(bin)}`;
}
