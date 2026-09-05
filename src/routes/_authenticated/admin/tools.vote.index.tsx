import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Copy, Plus, QrCode, Trash2, Vote } from "lucide-react";
import { toast } from "sonner";
import { AdminPage } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePickerField } from "@/components/DatePickerField";
import { useConfirm } from "@/components/ConfirmDialog";
import { QrCodeDialog } from "@/components/QrCodeDialog";
import { formatDateID, slugify } from "@/lib/absensi-ui";
import { defaultVoteCategories, type VoteSettings } from "@/lib/vote-ui";
import { deleteVoteEvent, listVoteEvents, saveVoteEvent } from "@/lib/vote.functions";

export const Route = createFileRoute("/_authenticated/admin/tools/vote/")({
  head: () => ({
    meta: [
      { title: "Vote — SuperIT Apps" },
      {
        name: "description",
        content:
          "Kelola voting apresiasi pekerja: buat event vote baru, atur nominasi, dan bagikan link votingnya.",
      },
      { property: "og:title", content: "Vote — SuperIT Apps" },
      { property: "og:description", content: "Voting apresiasi pekerja BRI BO Pringsewu." },
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
  const [qr, setQr] = useState<{
    url: string;
    title: string;
    dateText: string;
    locationText: string;
  } | null>(null);
  const [form, setForm] = useState({
    title: "Apresiasi Pekerja",
    subtitle: "Si Paling Brilian Ways",
    location: "BRI BO Pringsewu",
    eventDate: new Date().toISOString().slice(0, 10),
  });

  const q = useQuery({ queryKey: ["vote-events"], queryFn: () => listVoteEvents() });

  async function create() {
    if (form.title.trim().length < 3) {
      toast.error("Judul vote minimal 3 karakter");
      return;
    }
    setSaving(true);
    try {
      const slug = `${slugify(form.title)}-${Math.random().toString(36).slice(2, 7)}`;
      const res = await saveVoteEvent({
        data: {
          slug,
          title: form.title.trim(),
          subtitle: form.subtitle.trim(),
          eyebrow: "Program Apresiasi",
          showcaseNote: "Dashboard pengumuman pemenang",
          location: form.location.trim(),
          eventDate: form.eventDate,
          accent: "#a855f7",
          logo: null,
          categories: defaultVoteCategories,
          isHold: false,
          isClosed: false,
        },
      });
      setOpen(false);
      void navigate({ to: "/admin/tools/vote/$id", params: { id: res.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat vote event");
    }
    setSaving(false);
  }

  async function remove(id: string) {
    const ok = await confirm({
      title: "Hapus vote event?",
      description: "Semua nominasi dan suara pada vote event ini ikut terhapus.",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteVoteEvent({ data: { id } });
      toast.success("Vote event dihapus");
      void q.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus");
    }
  }

  function copyLink(slug: string) {
    void navigator.clipboard.writeText(`${window.location.origin}/vote/${slug}`);
    toast.success("Link voting disalin");
  }

  const events = (q.data?.events ?? []) as VoteSettings[];
  const counts = q.data?.counts ?? {};

  return (
    <AdminPage menuKey="tools">
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Vote className="size-6" /> Vote
            </h1>
            <p className="text-sm text-muted-foreground">
              Voting apresiasi pekerja. Setiap vote event punya link sendiri, daftar nominasi,
              admin, dan rekap suaranya masing-masing.
            </p>
          </div>
          {q.data?.panel ? (
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" /> Vote Event Baru
            </Button>
          ) : null}
        </div>

        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Memuat...</p>
        ) : events.length === 0 ? (
          <div className="glass-card p-8 text-center text-sm text-muted-foreground">
            Belum ada vote event.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {events.map((ev) => (
              <div key={ev.id} className="glass-card space-y-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-semibold">{ev.title}</h2>
                    <p className="text-xs text-muted-foreground">
                      {ev.subtitle} · {formatDateID(ev.eventDate)}
                    </p>
                  </div>
                  <Badge
                    variant={ev.isClosed ? "destructive" : ev.isHold ? "secondary" : "default"}
                  >
                    {ev.isClosed ? "Ditutup" : ev.isHold ? "Hold" : "Dibuka"}
                  </Badge>
                </div>
                <p className="text-sm">
                  <span className="font-semibold">{counts[ev.id] ?? 0}</span>{" "}
                  <span className="text-muted-foreground">suara masuk</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link to="/admin/tools/vote/$id" params={{ id: ev.id }}>
                      Kelola
                    </Link>
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => copyLink(ev.slug)}>
                    <Copy className="size-4" /> Salin link
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setQr({
                        url: `${window.location.origin}/vote/${ev.slug}`,
                        title: ev.title,
                        dateText: formatDateID(ev.eventDate),
                        locationText: ev.location || ev.subtitle || "BRI BO Pringsewu",
                      })
                    }
                  >
                    <QrCode className="size-4" /> Generate QR
                  </Button>
                  {q.data?.panel ? (
                    <Button size="sm" variant="ghost" onClick={() => void remove(ev.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vote Event Baru</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Judul</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <Label>Sub Judul</Label>
              <Input
                value={form.subtitle}
                onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))}
              />
            </div>
            <div>
              <Label>Lokasi Acara</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              />
            </div>
            <div>
              <Label>Tanggal</Label>
              <DatePickerField
                value={form.eventDate}
                onChange={(v) => setForm((f) => ({ ...f, eventDate: v }))}
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

      <QrCodeDialog
        open={!!qr}
        onOpenChange={(v) => !v && setQr(null)}
        url={qr?.url ?? ""}
        title={qr ? `QR Vote — ${qr.title}` : "QR Code"}
        fileName={qr ? `qr-vote-${qr.title}` : "qr-code"}
        eventName={qr?.title}
        dateText={qr?.dateText}
        locationText={qr?.locationText}
      />
    </AdminPage>
  );
}
