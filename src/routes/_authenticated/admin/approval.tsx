import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { AdminPage } from "@/components/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { accessLevels, levelToRole, type AccessLevel } from "@/lib/access";

const db = supabase as unknown as SupabaseClient;

export const Route = createFileRoute("/_authenticated/admin/approval")({
  head: () => ({
    meta: [
      { title: "Approval — Panel BRI BO Pringsewu" },
      { name: "description", content: "Persetujuan pendaftaran user baru dan permintaan lain." },
      { property: "og:title", content: "Approval — Panel BRI BO Pringsewu" },
      { property: "og:description", content: "Persetujuan pendaftaran user baru." },
    ],
  }),
  component: () => (
    <AdminPage menuKey="approval">
      <Page />
    </AdminPage>
  ),
});

type Req = {
  id: string;
  jenis: string;
  judul: string | null;
  detail: Record<string, unknown> | null;
  subject_user_id: string | null;
  status: string;
  akses_level: string | null;
  created_at: string;
};

function Page() {
  const qc = useQueryClient();
  const [levels, setLevels] = useState<Record<string, AccessLevel>>({});

  const list = useQuery({
    queryKey: ["approval_requests"],
    queryFn: async () => {
      const { data, error } = await db
        .from("approval_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Req[];
    },
  });

  const decide = useMutation({
    mutationFn: async ({ req, approve }: { req: Req; approve: boolean }) => {
      const level = levels[req.id] ?? "pekerja";
      const { error } = await db
        .from("approval_requests")
        .update({
          status: approve ? "approved" : "rejected",
          akses_level: approve ? level : null,
          decided_at: new Date().toISOString(),
        })
        .eq("id", req.id);
      if (error) throw error;

      if (req.jenis === "registrasi_user" && req.subject_user_id) {
        const { error: pe } = await db
          .from("profiles")
          .update({ status: approve ? "approved" : "rejected" })
          .eq("id", req.subject_user_id);
        if (pe) throw pe;
        if (approve) {
          await db.from("user_roles").delete().eq("user_id", req.subject_user_id);
          const { error: re } = await db
            .from("user_roles")
            .insert({ user_id: req.subject_user_id, role: levelToRole(level) });
          if (re) throw re;
        }
      }
    },
    onSuccess: (_d, v) => {
      toast.success(v.approve ? "Permintaan disetujui" : "Permintaan ditolak");
      void qc.invalidateQueries({ queryKey: ["approval_requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = list.data ?? [];
  const pending = rows.filter((r) => r.status === "pending");
  const history = rows.filter((r) => r.status !== "pending");

  return (
    <>
      <h1 className="text-2xl font-bold">
        <span className="gradient-text">Approval</span>
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Setujui atau tolak pendaftaran user baru dan permintaan lain yang butuh persetujuan admin.
      </p>

      <section className="mt-6 space-y-3">
        <h2 className="text-lg font-semibold">Menunggu Persetujuan ({pending.length})</h2>
        {pending.length === 0 ? (
          <div className="glass-card p-6 text-sm text-muted-foreground">
            Tidak ada permintaan yang menunggu.
          </div>
        ) : (
          pending.map((r) => (
            <div key={r.id} className="glass-card flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.judul ?? r.jenis}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {String(r.detail?.["nama"] ?? "")} · {String(r.detail?.["email"] ?? "")} ·{" "}
                  {new Date(r.created_at).toLocaleString("id-ID")}
                </p>
              </div>
              {r.jenis === "registrasi_user" ? (
                <Select
                  value={levels[r.id] ?? "pekerja"}
                  onValueChange={(v) => setLevels((s) => ({ ...s, [r.id]: v as AccessLevel }))}
                >
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Level akses" />
                  </SelectTrigger>
                  <SelectContent>
                    {accessLevels.map((l) => (
                      <SelectItem key={l.value} value={l.value}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
              <Button
                size="sm"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ req: r, approve: true })}
              >
                <Check className="size-4" /> Setujui
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ req: r, approve: false })}
              >
                <X className="size-4" /> Tolak
              </Button>
            </div>
          ))
        )}
      </section>

      <section className="mt-8 space-y-2">
        <h2 className="text-lg font-semibold">Riwayat</h2>
        {history.length === 0 ? (
          <div className="glass-card p-6 text-sm text-muted-foreground">Belum ada riwayat.</div>
        ) : (
          history.map((r) => (
            <div key={r.id} className="glass-card flex items-center gap-3 p-3 text-sm">
              <span className="min-w-0 flex-1 truncate">{r.judul ?? r.jenis}</span>
              {r.akses_level ? (
                <Badge variant="secondary" className="text-[10px]">
                  {accessLevels.find((l) => l.value === r.akses_level)?.label ?? r.akses_level}
                </Badge>
              ) : null}
              <Badge variant={r.status === "approved" ? "default" : "destructive"}>{r.status}</Badge>
            </div>
          ))
        )}
      </section>
    </>
  );
}
