/** Helper server-only untuk SuperIT Apps — Nomination. */
import { defaultBoard, normalizeBoard, type NominasiBoard, type NominasiEvent } from "@/lib/nominasi-ui";

type Db = { from: (t: string) => any };
type Row = Record<string, any>;

async function admin(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Db;
}

function toEvent(row: Row): NominasiEvent {
  return {
    id: String(row["id"]),
    namaAcara: String(row["nama_acara"] ?? "Best Performance"),
    tanggal: String(row["tanggal"] ?? ""),
    data: normalizeBoard(row["data"]),
  };
}

export async function isPanelAdmin(userId: string) {
  const db = await admin();
  const { data } = await db.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  return roles.includes("superadmin") || roles.includes("it_admin");
}

export async function assertAdmin(userId: string) {
  if (!(await isPanelAdmin(userId))) throw new Error("Akses admin diperlukan.");
}

export async function listEvents() {
  const db = await admin();
  const { data, error } = await db
    .from("nominasi_events")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toEvent);
}

export async function getEvent(id: string): Promise<NominasiEvent> {
  const db = await admin();
  const { data, error } = await db.from("nominasi_events").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Event nominasi tidak ditemukan.");
  return toEvent(data);
}

export async function createEvent(
  input: { namaAcara: string; tanggal: string; unit: string; period: string },
  userId: string,
) {
  const db = await admin();
  const board: NominasiBoard = {
    ...defaultBoard(),
    period: input.period || "Semester I",
    unit: input.unit || "BO PRINGSEWU",
  };
  const { data, error } = await db
    .from("nominasi_events")
    .insert({
      nama_acara: input.namaAcara,
      tanggal: input.tanggal,
      data: board,
      created_by: userId,
    })
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return String(data?.["id"]);
}

export async function saveEvent(input: {
  id: string;
  namaAcara?: string;
  tanggal?: string;
  data?: NominasiBoard;
}) {
  const db = await admin();
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.namaAcara !== undefined) row["nama_acara"] = input.namaAcara;
  if (input.tanggal !== undefined) row["tanggal"] = input.tanggal;
  if (input.data !== undefined) row["data"] = input.data;
  const { error } = await db.from("nominasi_events").update(row).eq("id", input.id);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function deleteEvent(id: string) {
  const db = await admin();
  const { error } = await db.from("nominasi_events").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}
