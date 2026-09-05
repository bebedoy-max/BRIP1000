import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, Copy, Palette, Plus, QrCode } from "lucide-react";
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
import {
  absensiFieldLabels,
  defaultAbsensiDisplay,
  formatDateID,
  slugify,
  type AbsensiDisplay,
  type AbsensiFields,
  type AbsensiSettings,
} from "@/lib/absensi-ui";
import {
  getAbsensiDisplayDefaults,
  listAbsensiEvents,
  saveAbsensiDisplayDefaults,
  saveAbsensiEvent,
} from "@/lib/absensi.functions";
import { DatePickerField } from "@/components/DatePickerField";
import { AbsensiDisplayEditor } from "@/components/AbsensiDisplayEditor";
import { QrCodeDialog } from "@/components/QrCodeDialog";

export const Route = createFileRoute("/_authenticated/admin/tools/absensi/")({
  head: () => ({
    meta: [
      { title: "Absensi Event — SuperIT Apps" },
      {
        name: "description",
        content: "Kelola absensi digital tiap event: buat link absensi baru dan pantau pesertanya.",
      },
      { property: "og:title", content: "Absensi Event — SuperIT Apps" },
      {
        property: "og:description",
        content: "Kelola absensi digital tiap event BRI BO Pringsewu.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

const defaultFields: AbsensiFields = {
  nama: true,
  personalNumber: true,
  unitKerja: true,
  noTelp: true,
  fotoSelfie: true,
};

function Page() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [qr, setQr] = useState<{
    url: string;
    title: string;
    dateText: string;
    locationText: string;
  } | null>(null);
  const [displayOpen, setDisplayOpen] = useState(false);
  const [display, setDisplay] = useState<AbsensiDisplay>(defaultAbsensiDisplay);
  const [savingDisplay, setSavingDisplay] = useState(false);
  const [form, setForm] = useState({
    eventName: "",
    officeName: "BRI BO Pringsewu",
    eventDate: new Date().toISOString().slice(0, 10),
  });
  const [fields, setFields] = useState<AbsensiFields>(defaultFields);

  const q = useQuery({
    queryKey: ["absensi-events"],
    queryFn: () => listAbsensiEvents(),
  });

  const dq = useQuery({
    queryKey: ["absensi-display-defaults"],
    queryFn: () => getAbsensiDisplayDefaults(),
  });

  function openDisplay() {
    setDisplay({ ...defaultAbsensiDisplay, ...((dq.data?.defaults ?? {}) as AbsensiDisplay) });
    setDisplayOpen(true);
  }

  async function saveDisplay() {
    setSavingDisplay(true);
    try {
      await saveAbsensiDisplayDefaults({ data: display });
      toast.success("Default tampilan tersimpan");
      setDisplayOpen(false);
      void dq.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan tampilan");
    }
    setSavingDisplay(false);
  }

  function startCreate() {
    setForm({
      eventName: "",
      officeName: "BRI BO Pringsewu",
      eventDate: new Date().toISOString().slice(0, 10),
    });
    setFields(defaultFields);
    setStep(1);
    setOpen(true);
  }

  async function create() {
    setSaving(true);
    try {
      const base = { ...defaultAbsensiDisplay, ...((dq.data?.defaults ?? {}) as AbsensiDisplay) };
      const slug = `${slugify(form.eventName)}-${Math.random().toString(36).slice(2, 7)}`;
      const res = await saveAbsensiEvent({
        data: {
          ...base,
          slug,
          eventName: form.eventName.trim(),
          officeName: form.officeName.trim(),
          eventDate: form.eventDate,
          fields,
          unitKerjaList: [],
          isOpen: true,
        },
      });
      setOpen(false);
      void navigate({ to: "/admin/tools/absensi/$id", params: { id: res.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat absensi event");
    }
    setSaving(false);
  }

  function linkOf(slug: string) {
    return `${typeof window === "undefined" ? "" : window.location.origin}/absensi/${slug}`;
  }

  function copyLink(slug: string) {
    void navigator.clipboard.writeText(linkOf(slug));
    toast.success("Link absensi disalin");
  }

  const events = (q.data?.events ?? []) as AbsensiSettings[];
  const counts = q.data?.counts ?? {};

  return (
    <AdminPage menuKey="tools">
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <CalendarCheck className="size-6" /> Absensi Event
            </h1>
            <p className="text-sm text-muted-foreground">
              Setiap event punya link absensi sendiri untuk dibagikan ke pekerja, lengkap dengan
              pengaturan dan admin masing-masing.
            </p>
          </div>
          {q.data?.panel ? (
            <div className="flex flex-wrap gap-2">
              <Button onClick={startCreate}>
                <Plus className="size-4" /> Absensi Event Baru
              </Button>
              <Button variant="secondary" onClick={openDisplay}>
                <Palette className="size-4" /> Tampilan
              </Button>
            </div>
          ) : null}
        </div>

        {q.isLoading ? (
          <p className="text-sm text-muted-foreground">Memuat...</p>
        ) : events.length === 0 ? (
          <div className="glass-card p-8 text-center text-sm text-muted-foreground">
            Belum ada absensi event.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {events.map((ev) => (
              <div key={ev.id} className="glass-card space-y-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-semibold">{ev.eventName}</h2>
                    <p className="text-xs text-muted-foreground">
                      {ev.officeName} · {formatDateID(ev.eventDate)}
                    </p>
                  </div>
                  <Badge variant={ev.isOpen ? "default" : "secondary"} className="shrink-0">
                    {ev.isOpen ? "Dibuka" : "Ditutup"}
                  </Badge>
                </div>
                <p className="text-sm">
                  <span className="font-semibold">{counts[ev.id] ?? 0}</span>{" "}
                  <span className="text-muted-foreground">peserta absen</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link to="/admin/tools/absensi/$id" params={{ id: ev.id }}>
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
                        url: linkOf(ev.slug),
                        title: ev.eventName,
                        dateText: formatDateID(ev.eventDate),
                        locationText: ev.officeName ?? "",
                      })
                    }
                  >
                    <QrCode className="size-4" /> Generate QR
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
            <DialogTitle>Absensi Event Baru · Langkah {step} dari 2</DialogTitle>
          </DialogHeader>
          {step === 1 ? (
            <div className="space-y-3">
              <div>
                <Label>Nama Event</Label>
                <Input
                  value={form.eventName}
                  onChange={(e) => setForm((f) => ({ ...f, eventName: e.target.value }))}
                  placeholder="Contoh: Brilian Culture Fest"
                />
              </div>
              <div>
                <Label>Nama Kantor</Label>
                <Input
                  value={form.officeName}
                  onChange={(e) => setForm((f) => ({ ...f, officeName: e.target.value }))}
                />
              </div>
              <div>
                <Label>Tanggal Event</Label>
                <DatePickerField
                  value={form.eventDate}
                  onChange={(v) => setForm((f) => ({ ...f, eventDate: v }))}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Pilih data apa saja yang diisi peserta pada form absensi.
              </p>
              {(Object.keys(absensiFieldLabels) as (keyof AbsensiFields)[]).map((key) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!fields[key]}
                    onChange={() => setFields((f) => ({ ...f, [key]: !f[key] }))}
                  />
                  {absensiFieldLabels[key]}
                </label>
              ))}
            </div>
          )}
          <DialogFooter>
            {step === 1 ? (
              <>
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Batal
                </Button>
                <Button
                  onClick={() => {
                    if (form.eventName.trim().length < 3) {
                      toast.error("Nama event minimal 3 karakter");
                      return;
                    }
                    setStep(2);
                  }}
                >
                  Lanjut
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setStep(1)}>
                  Kembali
                </Button>
                <Button onClick={create} disabled={saving}>
                  {saving ? "Menyimpan..." : "Buat"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={displayOpen} onOpenChange={setDisplayOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Default Tampilan Absensi Event Baru</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Pengaturan ini otomatis dipakai saat membuat absensi event baru. Tiap event tetap bisa
            diubah sendiri lewat menu pengaturannya.
          </p>
          <AbsensiDisplayEditor
            value={display}
            onChange={(patch) => setDisplay((d) => ({ ...d, ...patch }))}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDisplayOpen(false)}>
              Batal
            </Button>
            <Button onClick={saveDisplay} disabled={savingDisplay}>
              {savingDisplay ? "Menyimpan..." : "Simpan Default"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <QrCodeDialog
        open={!!qr}
        onOpenChange={(v) => !v && setQr(null)}
        url={qr?.url ?? ""}
        title={qr ? `QR Absensi — ${qr.title}` : "QR Code"}
        fileName={qr ? `qr-absensi-${qr.title}` : "qr-code"}
        eventName={qr?.title}
        dateText={qr?.dateText}
        locationText={qr?.locationText}
      />
    </AdminPage>
  );
}
