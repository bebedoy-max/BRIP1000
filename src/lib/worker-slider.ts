import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { slideImageSrc } from "@/lib/carousel";

const db = supabase as unknown as SupabaseClient;

/** Pilihan warna pulse glow untuk frame foto pekerja. */
export const glowColors = [
  { value: "", label: "Tanpa Glow", color: "transparent" },
  { value: "#22d3ee", label: "Cyan", color: "#22d3ee" },
  { value: "#3b82f6", label: "Biru", color: "#3b82f6" },
  { value: "#a855f7", label: "Ungu", color: "#a855f7" },
  { value: "#f59e0b", label: "Emas", color: "#f59e0b" },
  { value: "#ef4444", label: "Merah", color: "#ef4444" },
  { value: "#22c55e", label: "Hijau", color: "#22c55e" },
] as const;

export type WorkerSlideRow = {
  employee_id: string;
  aktif: boolean;
  urutan: number;
  glow_color: string | null;
};

export type WorkerSlide = {
  id: string;
  nama: string;
  jabatan: string;
  uker: string;
  photo: string | null;
  glow: string | null;
};

export type WorkerCandidate = { id: string; nama: string; sub: string };

/** Konfigurasi slide pekerja; kosong bila tabel belum dibuat. */
export async function loadWorkerSlideConfig(): Promise<WorkerSlideRow[]> {
  try {
    const { data, error } = await db
      .from("worker_slides")
      .select("employee_id,aktif,urutan,glow_color")
      .order("urutan", { ascending: true });
    if (error) return [];
    return (data ?? []) as WorkerSlideRow[];
  } catch {
    return [];
  }
}

/** Data lengkap pekerja yang tampil pada kolom slide dashboard. */
export async function loadWorkerSlides(): Promise<WorkerSlide[]> {
  const config = (await loadWorkerSlideConfig()).filter((c) => c.aktif);
  if (!config.length) return [];

  const { data } = await db
    .from("employees")
    .select("id,nama,n,jabatan_id,uker_id")
    .in(
      "id",
      config.map((c) => c.employee_id),
    );
  const rows = (data ?? []) as {
    id: string;
    nama: string;
    n: string | null;
    jabatan_id: string | null;
    uker_id: string | null;
  }[];

  const jabatanIds = [...new Set(rows.map((r) => r.jabatan_id).filter(Boolean))] as string[];
  const ukerIds = [...new Set(rows.map((r) => r.uker_id).filter(Boolean))] as string[];

  const jabatanMap = new Map<string, string>();
  if (jabatanIds.length) {
    const { data: jt } = await db.from("job_titles").select("id,nama_jabatan").in("id", jabatanIds);
    for (const j of (jt ?? []) as { id: string; nama_jabatan: string }[])
      jabatanMap.set(j.id, j.nama_jabatan);
  }
  const ukerMap = new Map<string, string>();
  if (ukerIds.length) {
    const { data: uk } = await db.from("ukers").select("id,nama_uker").in("id", ukerIds);
    for (const u of (uk ?? []) as { id: string; nama_uker: string }[]) ukerMap.set(u.id, u.nama_uker);
  }

  const byId = new Map(rows.map((r) => [r.id, r]));
  return config
    .map((c) => {
      const r = byId.get(c.employee_id);
      if (!r) return null;
      return {
        id: r.id,
        nama: r.nama,
        jabatan: r.jabatan_id ? (jabatanMap.get(r.jabatan_id) ?? "") : "",
        uker: r.uker_id ? (ukerMap.get(r.uker_id) ?? "") : "",
        photo: r.n ? slideImageSrc(r.n, 800) : null,
        glow: c.glow_color || null,
      } satisfies WorkerSlide;
    })
    .filter((s): s is WorkerSlide => !!s);
}

/** Daftar pekerja untuk dipilih admin. */
export async function loadWorkerCandidates(search = ""): Promise<WorkerCandidate[]> {
  let q = db.from("employees").select("id,nama,personal_number").order("nama").limit(50);
  if (search.trim()) q = q.ilike("nama", `%${search.trim()}%`);
  const { data } = await q;
  return ((data ?? []) as { id: string; nama: string; personal_number: string | null }[]).map(
    (e) => ({ id: e.id, nama: e.nama, sub: e.personal_number ?? "—" }),
  );
}
