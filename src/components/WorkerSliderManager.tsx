import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  glowColors,
  loadWorkerCandidates,
  loadWorkerSlideConfig,
  type WorkerSlideRow,
} from "@/lib/worker-slider";

const db = supabase as unknown as SupabaseClient;

/** Pengaturan pekerja yang tampil pada kolom slide dashboard + warna glow. */
export function WorkerSliderManager({ canWrite }: { canWrite: boolean }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const config = useQuery({ queryKey: ["worker-slide-config"], queryFn: loadWorkerSlideConfig });
  const candidates = useQuery({
    queryKey: ["worker-slide-candidates", search],
    queryFn: () => loadWorkerCandidates(search),
  });

  const rows = config.data ?? [];
  const rowOf = (id: string): WorkerSlideRow | undefined => rows.find((r) => r.employee_id === id);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["worker-slide-config"] });
    void qc.invalidateQueries({ queryKey: ["worker-slides"] });
  };

  const toggle = useMutation({
    mutationFn: async ({ id, on }: { id: string; on: boolean }) => {
      if (on) {
        const { error } = await db
          .from("worker_slides")
          .upsert(
            { employee_id: id, aktif: true, urutan: rows.length + 1 },
            { onConflict: "employee_id" },
          );
        if (error) throw error;
      } else {
        const { error } = await db.from("worker_slides").delete().eq("employee_id", id);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const setGlow = useMutation({
    mutationFn: async ({ id, color }: { id: string; color: string }) => {
      const { error } = await db
        .from("worker_slides")
        .upsert(
          { employee_id: id, aktif: true, glow_color: color || null, urutan: rows.length + 1 },
          { onConflict: "employee_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Warna glow disimpan");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const items = candidates.data ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Slide Profil Pekerja</h1>
        <p className="text-sm text-muted-foreground">
          Pilih pekerja yang tampil pada kolom slide profil di bawah infografis dashboard, dan atur
          warna pulse glow untuk frame fotonya.
        </p>
      </div>

      <div className="glass-card space-y-4 p-4">
        <div className="grid gap-2 sm:max-w-sm">
          <Label htmlFor="cari">Cari Pekerja</Label>
          <Input
            id="cari"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nama pekerja"
          />
        </div>

        <div className="rounded-xl border border-border/60">
          {candidates.isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Memuat pekerja…</p>
          ) : items.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Pekerja tidak ditemukan.</p>
          ) : (
            items.map((i) => {
              const row = rowOf(i.id);
              return (
                <div
                  key={i.id}
                  className="flex flex-wrap items-center gap-3 border-b border-border/40 px-3 py-2.5 text-sm last:border-0"
                >
                  <Checkbox
                    checked={!!row}
                    disabled={!canWrite || toggle.isPending}
                    onCheckedChange={(v) => toggle.mutate({ id: i.id, on: !!v })}
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">{i.nama}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{i.sub}</span>
                  <select
                    className="h-9 shrink-0 rounded-xl border border-input bg-popover px-2 text-xs"
                    value={row?.glow_color ?? ""}
                    disabled={!canWrite || !row}
                    onChange={(e) => setGlow.mutate({ id: i.id, color: e.target.value })}
                  >
                    {glowColors.map((g) => (
                      <option key={g.value} value={g.value}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                  <span
                    aria-hidden="true"
                    className="size-4 shrink-0 rounded-full border border-border"
                    style={{ background: row?.glow_color || "transparent" }}
                  />
                </div>
              );
            })
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {rows.length ? `${rows.length} pekerja tampil di slide` : "Belum ada pekerja dipilih"}
        </p>
        <Button variant="secondary" onClick={invalidate}>
          Muat Ulang
        </Button>
      </div>
    </div>
  );
}
