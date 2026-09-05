import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { AdminLayout, AccessDenied } from "@/components/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { useRoles } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  head: () => ({
    meta: [
      { title: "Audit Log — Panel BRI BO Pringsewu" },
      { name: "description", content: "Riwayat perubahan data sensitif pada sistem internal." },
      { property: "og:title", content: "Audit Log — Panel BRI BO Pringsewu" },
      { property: "og:description", content: "Riwayat perubahan data sensitif sistem internal." },
    ],
  }),
  component: Page,
});

function Page() {
  const { isSuperadmin, loading } = useRoles();
  const logs = useQuery({
    queryKey: ["audit_logs"],
    enabled: isSuperadmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!loading && !isSuperadmin)
    return (
      <AdminLayout>
        <AccessDenied />
      </AdminLayout>
    );

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold">Audit Log</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        200 perubahan terakhir pada tabel unit kerja, pegawai, dan pengguna.
      </p>
      <div className="glass-card mt-6 space-y-3 p-4">
        {(logs.data ?? []).length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Belum ada catatan.</p>
        ) : (
          (logs.data ?? []).map((l) => (
            <details key={l.id} className="rounded-xl border border-border/50 p-3">
              <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm">
                <Badge variant="secondary">{l.action}</Badge>
                <span className="font-medium">{l.table_name}</span>
                <span className="text-muted-foreground">{l.record_id}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {l.created_at ? new Date(l.created_at).toLocaleString("id-ID") : ""}
                </span>
              </summary>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <pre className="overflow-x-auto rounded-lg bg-secondary/60 p-3 text-xs">
                  {JSON.stringify(l.old_value, null, 2)}
                </pre>
                <pre className="overflow-x-auto rounded-lg bg-secondary/60 p-3 text-xs">
                  {JSON.stringify(l.new_value, null, 2)}
                </pre>
              </div>
            </details>
          ))
        )}
      </div>
    </AdminLayout>
  );
}