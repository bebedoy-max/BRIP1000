import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { projectParamSummary, resolveProjectItems } from "@/lib/projects";

const db = supabase as unknown as SupabaseClient;

type Row = Record<string, unknown>;

export type ProjectSummaryRow = {
  id: string;
  nama: string;
  deskripsi: string;
  parameterNoun: string;
  tanggalMulai: string | null;
  deadline: string | null;
  total: number;
  done: number;
  pct: number;
};

async function loadSummary(): Promise<ProjectSummaryRow[]> {
  const { data, error } = await db
    .from("projects")
    .select("*")
    .order("deadline", { ascending: true });
  if (error) throw error;

  const out: ProjectSummaryRow[] = [];
  for (const p of (data ?? []) as Row[]) {
    let total = 0;
    try {
      total = (await resolveProjectItems(p)).length;
    } catch {
      total = 0;
    }
    const { count } = await db
      .from("project_progress")
      .select("id", { count: "exact", head: true })
      .eq("project_id", String(p["id"]));
    const done = count ?? 0;
    out.push({
      id: String(p["id"]),
      nama: String(p["nama_project"] ?? ""),
      deskripsi: String(p["deskripsi"] ?? ""),
      parameterNoun: projectParamSummary(p),
      tanggalMulai: p["tanggal_mulai"] ? String(p["tanggal_mulai"]) : null,
      deadline: p["deadline"] ? String(p["deadline"]) : null,
      total,
      done,
      pct: total ? Math.round((done / total) * 100) : 0,
    });
  }
  return out;
}

export function useProjectSummary() {
  return useQuery({ queryKey: ["projects-progress-summary"], queryFn: loadSummary });
}

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("id-ID", { dateStyle: "medium" }) : "—";

export function ProjectSummary({ limit }: { limit?: number }) {
  const q = useProjectSummary();
  const fromPath = useRouterState({ select: (st) => st.location.pathname });
  const rows = (q.data ?? []).slice(0, limit ?? 100);

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Memuat project…</p>;
  if (rows.length === 0)
    return <p className="text-sm text-muted-foreground">Belum ada project berjalan.</p>;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {rows.map((p) => (
        <Link
          key={p.id}
          to="/project/$id"
          params={{ id: p.id }}
          search={{ from: fromPath }}
          aria-label={`Lihat detail project ${p.nama}`}

          className="glass-card block p-5 transition-transform duration-200 hover:-translate-y-0.5 hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold">{p.nama}</h3>
            <span className="text-2xl font-bold tabular-nums">{p.pct}%</span>
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.deskripsi}</p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary" style={{ width: `${p.pct}%` }} />
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
            <div>
              <dt>Mulai</dt>
              <dd className="text-foreground">{fmt(p.tanggalMulai)}</dd>
            </div>
            <div>
              <dt>Deadline</dt>
              <dd className="text-foreground">{fmt(p.deadline)}</dd>
            </div>
            <div>
              <dt>Pencapaian</dt>
              <dd className="text-foreground">
                {p.done}/{p.total} item
              </dd>
            </div>
          </dl>
        </Link>
      ))}
    </div>
  );
}
