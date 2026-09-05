import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ArrowLeft, Lock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PublicLayout } from "@/components/PublicLayout";
import { Button } from "@/components/ui/button";
import { useDetailAccess } from "@/lib/access";
import {
  resolveProjectItems,
  projectParamSummary,
  projectItemColumnLabel,
} from "@/lib/projects";

const db = supabase as unknown as SupabaseClient;

export const Route = createFileRoute("/project/$id")({
  validateSearch: (search: Record<string, unknown>): { from?: string } => {
    const out: { from?: string } = {};
    if (typeof search["from"] === "string") out.from = search["from"];
    return out;
  },
  head: () => ({
    meta: [
      { title: "Detail Project IT — BRI BO Pringsewu" },
      {
        name: "description",
        content: "Rincian pencapaian project IT BRI Branch Office Pringsewu per item target.",
      },
      { property: "og:title", content: "Detail Project IT — BRI BO Pringsewu" },
      {
        property: "og:description",
        content: "Progress dan status pencapaian tiap item target project IT.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProjectDetailPage,
});

type Row = Record<string, unknown>;

const fmt = (d: unknown) =>
  d ? new Date(String(d)).toLocaleDateString("id-ID", { dateStyle: "medium" }) : "—";

type StatusKind = "done" | "done_note" | "todo";

function statusLabel(k: StatusKind) {
  return k === "done" ? "Done" : k === "done_note" ? "Done dengan keterangan" : "Belum Done";
}

function statusClass(k: StatusKind) {
  return k === "done"
    ? "bg-primary/15 text-primary"
    : k === "done_note"
      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
      : "bg-secondary text-muted-foreground";
}

function ProjectDetailPage() {
  const { id } = useParams({ from: "/project/$id" });
  const access = useDetailAccess("project");

  const q = useQuery({
    queryKey: ["project-detail", id],
    enabled: access.allowed,
    queryFn: async () => {
      const { data, error } = await db.from("projects").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      const project = (data ?? null) as Row | null;
      if (!project) return null;

      const items = await resolveProjectItems(project);
      const { data: prog, error: pe } = await db
        .from("project_progress")
        .select("item_id, item_label, keterangan")
        .eq("project_id", id);
      if (pe) throw pe;

      const map = new Map<string, Row>();
      for (const r of (prog ?? []) as Row[]) map.set(String(r["item_id"]), r);

      const rows = items.map((it) => {
        const hit = map.get(it.id);
        const keterangan = hit ? String(hit["keterangan"] ?? "").trim() : "";
        const status: StatusKind = !hit ? "todo" : keterangan ? "done_note" : "done";
        return { id: it.id, label: it.label, status, keterangan };
      });
      const done = rows.filter((r) => r.status !== "todo").length;
      return {
        project,
        rows,
        done,
        total: rows.length,
        pct: rows.length ? Math.round((done / rows.length) * 100) : 0,
      };
    },
  });

  return (
    <PublicLayout>
      <BackLink />

      {access.loading ? (
        <p className="mt-8 text-sm text-muted-foreground">Memeriksa hak akses…</p>
      ) : !access.allowed ? (
        <section className="glass-card mt-6 flex flex-col items-start gap-3 p-8">
          <span className="grid size-12 place-items-center rounded-2xl bg-secondary">
            <Lock className="size-5 text-muted-foreground" />
          </span>
          <h1 className="text-lg font-semibold">Detail terkunci</h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            {access.loggedIn
              ? "Level akses Anda belum diizinkan melihat rincian project ini."
              : "Rincian project hanya dapat dilihat setelah masuk."}
          </p>
          {!access.loggedIn ? (
            <Button asChild className="mt-1">
              <Link to="/auth">Masuk untuk melihat</Link>
            </Button>
          ) : null}
        </section>
      ) : q.isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">Memuat data project…</p>
      ) : q.isError || !q.data ? (
        <p className="mt-8 text-sm text-muted-foreground">Project tidak ditemukan.</p>
      ) : (
        <ProjectBody data={q.data} />
      )}
    </PublicLayout>
  );
}

function ProjectBody({
  data,
}: {
  data: {
    project: Row;
    rows: { id: string; label: string; status: StatusKind; keterangan: string }[];
    done: number;
    total: number;
    pct: number;
  };
}) {
  const p = data.project;
  return (
    <>
      <header className="mt-4">
        <h1 className="text-2xl font-bold">
          <span className="gradient-text">{String(p["nama_project"] ?? "Project")}</span>
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          {String(p["deskripsi"] ?? "") || "Tidak ada deskripsi."}
        </p>
      </header>

      <section className="glass-card mt-5 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <dl className="grid grid-cols-2 gap-4 text-xs text-muted-foreground sm:grid-cols-3">
            <div>
              <dt>Mulai</dt>
              <dd className="text-sm text-foreground">{fmt(p["tanggal_mulai"])}</dd>
            </div>
            <div>
              <dt>Deadline</dt>
              <dd className="text-sm text-foreground">{fmt(p["deadline"])}</dd>
            </div>
            <div>
              <dt>Parameter</dt>
              <dd className="text-sm text-foreground">{projectParamSummary(p)}</dd>
            </div>
          </dl>
          <div className="text-right">
            <p className="text-3xl font-bold tabular-nums">{data.pct}%</p>
            <p className="text-xs text-muted-foreground">
              {data.done} dari {data.total} item
            </p>
          </div>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary" style={{ width: `${data.pct}%` }} />
        </div>
      </section>

      <section className="glass-card mt-5 overflow-x-auto p-1">
        <table className="w-full min-w-[680px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              {["No", projectItemColumnLabel(p), "Status", "Keterangan"].map((h, i, arr) => (
                <th
                  key={h}
                  className={`bg-secondary/40 p-3 text-left font-semibold backdrop-blur-xl ${
                    i === 0 ? "rounded-tl-xl" : ""
                  } ${i === arr.length - 1 ? "rounded-tr-xl" : ""}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r, i) => (
              <tr key={r.id} className="transition-colors hover:bg-secondary/20">
                <td className="border-t border-border/40 p-3 align-top tabular-nums">{i + 1}</td>
                <td className="border-t border-border/40 p-3 align-top">{r.label}</td>
                <td className="border-t border-border/40 p-3 align-top">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(r.status)}`}
                  >
                    {statusLabel(r.status)}
                  </span>
                </td>
                <td className="border-t border-border/40 p-3 align-top text-muted-foreground">
                  {r.keterangan || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.rows.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">Belum ada item target pada project ini.</p>
        ) : (
          <p className="p-3 text-xs text-muted-foreground">{data.rows.length} item ditampilkan.</p>
        )}
      </section>
    </>
  );
}

function BackLink() {
  const { from } = Route.useSearch();
  const target = from && from.startsWith("/") && !from.startsWith("//") ? from : "/";
  const label = target.startsWith("/admin") ? "Kembali ke panel" : "Kembali ke dashboard";
  return (
    <Link
      to={target as "/"}
      className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> {label}
    </Link>
  );
}
