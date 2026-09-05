import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MonitorPlay, Plus, Trash2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { AdminPage } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePickerField } from "@/components/DatePickerField";
import { useConfirm } from "@/components/ConfirmDialog";
import { formatTanggalIndo, type NominasiEvent } from "@/lib/nominasi-ui";
import {
  createNominasiEvent,
  deleteNominasiEvent,
  listNominasiEvents,
} from "@/lib/nominasi.functions";

export const Route = createFileRoute("/_authenticated/admin/tools/nominasi/")({
  head: () => ({
    meta: [
      { title: "Nomination — SuperIT Apps" },
      {
        name: "description",
        content:
          "Kelola papan nominasi Best Performance: buat event nominasi, atur kategori dan nominasi, lalu mainkan papannya saat acara.",
      },
      { property: "og:title", content: "Nomination — SuperIT Apps" },
      { property: "og:description", content: "Papan apresiasi Best Performance BRI BO Pringsewu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    namaAcara: "Best Performance",
    period: "Semester I",
    unit: "BO PRINGSEWU",
    tanggal: new Date().toISOString().slice(0, 10),
  });

  const q = useQuery({ queryKey: ["nominasi-events"], queryFn: () => listNominasiEvents() });

  async function create() {
    setSaving(true);
    try {
      const res = await createNominasiEvent({ data: form });
      setOpen(false);
      void navigate({ to: "/admin/tools/nominasi/$id", params: { id: res.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat event nominasi");
    }
    setSaving(false);
  }

  async function remove(id: string) {
    const ok = await confirm({
      title: "Hapus event nominasi?",
      description: "Semua kategori dan nominasi pada event ini ikut terhapus.",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteNominasiEvent({ data: { id } });
      toast.success("Event nominasi dihapus");
      void q.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus");
    }
  }

  const events = (q.data?.events ?? []) as NominasiEvent[];

  return (
    <AdminPage menuKey="tools">
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Trophy className="size-6" /> Nomination
            </h1>
            <p className="text-sm text-muted-foreground">
              Papan apresiasi Best Performance. Atur kategori dan nominasinya di panel, lalu mainkan
              papannya saat acara pengumuman.
            </p>
          </div>
          {q.data?.panel ? (
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" /> Event Nominasi Baru
            </Button>
          ) : null}
        </div>

        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Memuat...</p>
        ) : events.length === 0 ? (
          <div className="glass-card p-8 text-center text-sm text-muted-foreground">
            Belum ada event nominasi.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {events.map((ev) => {
              const jumlahNominasi = ev.data.categories.reduce(
                (a, c) => a + c.nominees.length,
                0,
              );
              return (
                <div key={ev.id} className="glass-card space-y-3 p-5">
                  <div>
                    <h2 className="font-semibold">{ev.namaAcara}</h2>
                    <p className="text-xs text-muted-foreground">
                      {ev.data.period} · {ev.data.unit} · {formatTanggalIndo(ev.tanggal)}
                    </p>
                  </div>
                  <p className="text-sm">
                    <span className="font-semibold">{ev.data.categories.length}</span>{" "}
                    <span className="text-muted-foreground">kategori ·</span>{" "}
                    <span className="font-semibold">{jumlahNominasi}</span>{" "}
                    <span className="text-muted-foreground">nominasi</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm">
                      <Link to="/admin/tools/nominasi/$id" params={{ id: ev.id }}>
                        Kelola
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="secondary">
                      <Link to="/admin/tools/nominasi/papan/$id" params={{ id: ev.id }}>
                        <MonitorPlay className="size-4" /> Papan
                      </Link>
                    </Button>
                    {q.data?.panel ? (
                      <Button size="sm" variant="ghost" onClick={() => void remove(ev.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Event Nominasi Baru</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nama Acara</Label>
              <Input
                value={form.namaAcara}
                onChange={(e) => setForm((f) => ({ ...f, namaAcara: e.target.value }))}
              />
            </div>
            <div>
              <Label>Periode</Label>
              <Input
                value={form.period}
                onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))}
              />
            </div>
            <div>
              <Label>Nama Unit Kerja</Label>
              <Input
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
              />
            </div>
            <div>
              <Label>Tanggal</Label>
              <DatePickerField
                value={form.tanggal}
                onChange={(v) => setForm((f) => ({ ...f, tanggal: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button onClick={create} disabled={saving}>
              {saving ? "Menyimpan..." : "Buat"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}
