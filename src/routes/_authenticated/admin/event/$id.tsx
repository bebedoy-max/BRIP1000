import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { AdminLayout, AccessDenied } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { useRoles } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/admin/event/$id")({
  head: () => ({
    meta: [
      { title: "Detail Event & Daftar Hadir — BRI BO Pringsewu" },
      { name: "description", content: "Detail event, QR absensi, dan daftar hadir peserta." },
      { property: "og:title", content: "Detail Event & Daftar Hadir — BRI BO Pringsewu" },
      { property: "og:description", content: "QR absensi dan laporan kehadiran peserta event." },
    ],
  }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const { isEventAdmin, loading } = useRoles();
  const [qr, setQr] = useState<string | null>(null);

  const event = useQuery({
    queryKey: ["event", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const attendances = useQuery({
    queryKey: ["attendances", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendances")
        .select("nama_manual, uker_manual, waktu_hadir, catatan")
        .eq("event_id", id)
        .order("waktu_hadir", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const link =
    typeof window !== "undefined" && event.data
      ? `${window.location.origin}/absen/${event.data.qr_token}`
      : "";

  useEffect(() => {
    if (!link) return;
    void import("qrcode").then((m) =>
      m.toDataURL(link, { width: 320, margin: 1 }).then(setQr).catch(() => setQr(null)),
    );
  }, [link]);

  async function exportExcel() {
    const rows = (attendances.data ?? []).map((a, i) => ({
      No: i + 1,
      Nama: a.nama_manual ?? "",
      "Unit Kerja": a.uker_manual ?? "",
      "Waktu Hadir": a.waktu_hadir ? new Date(a.waktu_hadir).toLocaleString("id-ID") : "",
      Catatan: a.catatan ?? "",
    }));
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Daftar Hadir");
    XLSX.writeFile(wb, `absensi-${event.data?.nama_event ?? "event"}.xlsx`);
  }

  if (!loading && !isEventAdmin)
    return (
      <AdminLayout>
        <AccessDenied />
      </AdminLayout>
    );

  return (
    <AdminLayout>
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link to="/admin/event">
          <ArrowLeft className="size-4" /> Kembali
        </Link>
      </Button>

      <h1 className="text-2xl font-bold">{event.data?.nama_event ?? "Memuat…"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{event.data?.deskripsi}</p>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="glass-card p-6 text-center">
          <h2 className="mb-3 text-sm font-semibold">QR Absensi</h2>
          {qr ? (
            <img src={qr} alt="QR code absensi event" className="mx-auto rounded-xl bg-white p-2" />
          ) : (
            <p className="text-sm text-muted-foreground">Menyiapkan QR…</p>
          )}
          <p className="mt-3 break-all text-xs text-muted-foreground">{link}</p>
          <Button
            size="sm"
            variant="secondary"
            className="mt-3"
            onClick={() => {
              void navigator.clipboard.writeText(link);
              toast.success("Link disalin");
            }}
          >
            <Copy className="size-4" /> Salin Link
          </Button>
        </div>

        <div className="glass-card overflow-x-auto p-0 lg:col-span-2">
          <div className="flex items-center justify-between gap-3 border-b border-border/60 p-4">
            <h2 className="text-sm font-semibold">
              Daftar Hadir ({attendances.data?.length ?? 0})
            </h2>
            <Button size="sm" onClick={exportExcel}>
              <Download className="size-4" /> Export Excel
            </Button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs tracking-wide text-muted-foreground uppercase">
                <th className="px-4 py-3 font-medium">Nama</th>
                <th className="px-4 py-3 font-medium">Unit Kerja</th>
                <th className="px-4 py-3 font-medium">Waktu Hadir</th>
                <th className="px-4 py-3 font-medium">Catatan</th>
              </tr>
            </thead>
            <tbody>
              {(attendances.data ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    Belum ada peserta yang absen.
                  </td>
                </tr>
              ) : (
                (attendances.data ?? []).map((a, i) => (
                  <tr key={i} className="border-t border-border/40">
                    <td className="px-4 py-3">{a.nama_manual}</td>
                    <td className="px-4 py-3">{a.uker_manual}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {a.waktu_hadir ? new Date(a.waktu_hadir).toLocaleString("id-ID") : "—"}
                    </td>
                    <td className="px-4 py-3">{a.catatan ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}