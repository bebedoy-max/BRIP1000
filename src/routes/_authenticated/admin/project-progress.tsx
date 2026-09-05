import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { toast } from "sonner";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { AdminLayout, AccessDenied } from "@/components/AdminLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useRoles } from "@/lib/roles";
import { projectParamSummary, resolveProjectItems } from "@/lib/projects";

const db = supabase as unknown as SupabaseClient;

export const Route = createFileRoute("/_authenticated/admin/project-progress")({
  head: () => ({
    meta: [
      { title: "Project Update Progress — Panel BRI BO Pringsewu" },
      { name: "description", content: "Update progress pengerjaan project IT per item pencapaian." },
      { property: "og:title", content: "Project Update Progress — Panel BRI BO Pringsewu" },
      { property: "og:description", content: "Tandai item yang sudah selesai dan pantau persentase progress project IT." },
    ],
  }),
  component: Page,
});

type Row = Record<string, unknown>;

function Page() {
  const r = useRoles();
  return (
    <AdminLayout>
      {r.loading ? null : r.isItAdmin ? <Progress /> : <AccessDenied />}
    </AdminLayout>
  );
}

function Progress() {
  const qc = useQueryClient();
  const [projectId, setProjectId] = useState("");
  const [q, setQ] = useState("");
  const [note, setNote] = useState("");

  const projects = useQuery({
    queryKey: ["projects-running"],
    queryFn: async () => {
      const { data, error } = await db
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const project = (projects.data ?? []).find((p) => String(p["id"]) === projectId) ?? null;
  const items = useQuery({
    queryKey: ["project-items", projectId],
    enabled: !!project,
    queryFn: async () => resolveProjectItems(project!),
  });

  const done = useQuery({
    queryKey: ["project-progress", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await db
        .from("project_progress")
        .select("id, item_id, item_label, keterangan, created_at")
        .eq("project_id", projectId);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const doneMap = useMemo(() => {
    const m = new Map<string, Row>();
    for (const d of done.data ?? []) m.set(String(d["item_id"]), d);
    return m;
  }, [done.data]);

  const toggle = useMutation({
    mutationFn: async (item: { id: string; label: string; next: boolean }) => {
      if (item.next) {
        const { data: auth } = await db.auth.getUser();
        const { error } = await db.from("project_progress").insert({
          project_id: projectId,
          item_id: item.id,
          item_label: item.label,
          keterangan: note.trim() || null,
          created_by: auth.user?.id ?? null,
        });
        if (error) throw error;
      } else {
        const { error } = await db
          .from("project_progress")
          .delete()
          .eq("project_id", projectId)
          .eq("item_id", item.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["project-progress", projectId] });
      void qc.invalidateQueries({ queryKey: ["projects-progress-summary"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = (items.data ?? []).filter((i) =>
    q.trim() ? i.label.toLowerCase().includes(q.toLowerCase()) : true,
  );
  const total = items.data?.length ?? 0;
  const doneCount = doneMap.size;
  const pct = total ? Math.round((doneCount / total) * 100) : 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Project Update Progress</h1>
        <p className="text-sm text-muted-foreground">
          Pilih project yang sedang berjalan, lalu tandai item mana saja yang sudah selesai.
        </p>
      </div>

      <div className="glass-card grid gap-4 p-5 md:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="project">Nama Project</Label>
          <select
            id="project"
            className="h-10 rounded-xl border border-input bg-popover px-3 text-sm"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">— pilih project —</option>
            {(projects.data ?? []).map((p) => (
              <option key={String(p["id"])} value={String(p["id"])}>
                {String(p["nama_project"])}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="note">Keterangan</Label>
          <Textarea
            id="note"
            value={note}
            placeholder="Informasi tambahan yang tercatat saat menandai item selesai (opsional)"
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>

      {project ? (
        <div className="glass-card space-y-4 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">{String(project["deskripsi"] ?? "")}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Parameter: {projectParamSummary(project)} · Deadline:{" "}
                {project["deadline"]
                  ? new Date(String(project["deadline"])).toLocaleDateString("id-ID")
                  : "—"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold tabular-nums">{pct}%</p>
              <p className="text-xs text-muted-foreground">
                {doneCount} dari {total} item
              </p>
            </div>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>

          <div className="relative max-w-sm">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari item…"
              className="pl-9"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <th className="px-3 py-3 font-medium">Item</th>
                  <th className="px-3 py-3 font-medium">Keterangan</th>
                  <th className="px-3 py-3 font-medium">Selesai</th>
                </tr>
              </thead>
              <tbody>
                {items.isLoading ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">
                      Memuat item…
                    </td>
                  </tr>
                ) : list.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">
                      Belum ada data item untuk parameter ini.
                    </td>
                  </tr>
                ) : (
                  list.map((i) => {
                    const d = doneMap.get(i.id);
                    return (
                      <tr key={i.id} className="border-b border-border/40 last:border-0">
                        <td className="px-3 py-3">{i.label}</td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {d ? String(d["keterangan"] ?? "—") : "—"}
                        </td>
                        <td className="px-3 py-3">
                          <Switch
                            checked={!!d}
                            onCheckedChange={(v) =>
                              toggle.mutate({ id: i.id, label: i.label, next: v })
                            }
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="glass-card p-8 text-center text-sm text-muted-foreground">
          Pilih project terlebih dahulu untuk mulai memperbarui progress.
          <div className="mt-3">
            <Button variant="secondary" onClick={() => void projects.refetch()}>
              Muat ulang daftar project
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
