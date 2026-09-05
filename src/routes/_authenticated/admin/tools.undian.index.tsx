import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Gift, Plus, Trash2 } from "lucide-react";
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
import { formatTanggalIndo, type UndianSettings } from "@/lib/undian-ui";
import { deleteUndianEvent, listUndianEvents, saveUndianEvent } from "@/lib/undian.functions";

export const Route = createFileRoute("/_authenticated/admin/tools/undian/")({
  head: () => ({
    meta: [
      { title: "Undian — SuperIT Apps" },
      {
        name: "description",
        content:
          "Kelola undian doorprize acara: buat event undian, atur kategori, hadiah, peserta, lalu kocok pemenangnya.",
      },
      { property: "og:title", content: "Undian — SuperIT Apps" },
      { property: "og:description", content: "Undian doorprize acara BRI BO Pringsewu." },
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
    namaAcara: "Undian Doorprize",
    namaKantor: "BRI BO Pringsewu",
    tanggal: new Date().toISOString().slice(0, 10),
  });

  const q = useQuery({ queryKey: ["undian-events"], queryFn: () => listUndianEvents() });

  async function create() {
    if (form.namaAcara.trim().length < 3) {
      toast.error("Nama acara minimal 3 karakter");
      return;
    }
    setSaving(true);
    try {
      const res = await saveUndianEvent({
        data: {
          namaAcara: form.namaAcara.trim(),
          namaKantor: form.namaKantor.trim() || "BRI BO Pringsewu",
          tanggal: form.tanggal,
          themeColor: "#1d6eb7",
          logoUrl: null,
          bgUrl: null,
        },
      });
      setOpen(false);
      void navigate({ to: "/admin/tools/undian/$id", params: { id: res.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat event undian");
    }
    setSaving(false);
  }

  async function remove(id: string) {
    const ok = await confirm({
      title: "Hapus event undian?",
      description: "Semua kategori, hadiah, peserta, dan pemenang pada event ini ikut terhapus.",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteUndianEvent({ data: { id } });
      toast.success("Event undian dihapus");
      void q.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus");
    }
  }

  const events = (q.data?.events ?? []) as UndianSettings[];
  const counts = (q.data?.counts ?? {}) as Record<string, { peserta: number; pemenang: number }>;

  return (
    <AdminPage menuKey="tools">
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Gift className="size-6" /> Undian
            </h1>
            <p className="text-sm text-muted-foreground">
              Undian doorprize acara. Setiap event punya kategori, hadiah, peserta, dan laporan
              pemenangnya sendiri. Undian dijalankan langsung oleh admin di panggung.
            </p>
          </div>
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Event Undian Baru
          </Button>
        </div>

        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Memuat...</p>
        ) : events.length === 0 ? (
          <div className="glass-card p-8 text-center text-sm text-muted-foreground">
            Belum ada event undian.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {events.map((ev) => (
              <div key={ev.id} className="glass-card space-y-3 p-5">
                <div>
                  <h2 className="font-semibold">{ev.namaAcara}</h2>
                  <p className="text-xs text-muted-foreground">
                    {ev.namaKantor} · {formatTanggalIndo(ev.tanggal)}
                  </p>
                </div>
                <p className="text-sm">
                  <span className="font-semibold">{counts[ev.id]?.peserta ?? 0}</span>{" "}
                  <span className="text-muted-foreground">peserta ·</span>{" "}
                  <span className="font-semibold">{counts[ev.id]?.pemenang ?? 0}</span>{" "}
                  <span className="text-muted-foreground">pemenang</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link to="/admin/tools/undian/$id" params={{ id: ev.id }}>
                      Kelola & Mainkan
                    </Link>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void remove(ev.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Event Undian Baru</DialogTitle>
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
              <Label>Nama Kantor</Label>
              <Input
                value={form.namaKantor}
                onChange={(e) => setForm((f) => ({ ...f, namaKantor: e.target.value }))}
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
