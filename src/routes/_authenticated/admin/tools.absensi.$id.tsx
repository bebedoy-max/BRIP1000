import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Copy, QrCode, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminPage } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  absensiFieldLabels,
  exportAbsensiExcel,
  exportAbsensiJSON,
  exportAbsensiPDF,
  formatDateID,
  type AbsensiEntry,
  type AbsensiFields,
  type AbsensiSettings,
} from "@/lib/absensi-ui";
import {
  clearAbsensiEntries,
  deleteAbsensiEntry,
  deleteAbsensiEvent,
  getAbsensiAdminEvent,
  saveAbsensiEvent,
} from "@/lib/absensi.functions";
import { DatePickerField } from "@/components/DatePickerField";
import { AbsensiDisplayEditor } from "@/components/AbsensiDisplayEditor";
import { QrCodeDialog } from "@/components/QrCodeDialog";

export const Route = createFileRoute("/_authenticated/admin/tools/absensi/$id")({
  head: () => ({
    meta: [
      { title: "Pengaturan Absensi Event — SuperIT Apps" },
      {
        name: "description",
        content: "Atur tampilan, field, admin, dan data peserta untuk satu absensi event.",
      },
      { property: "og:title", content: "Pengaturan Absensi Event — SuperIT Apps" },
      {
        property: "og:description",
        content: "Atur tampilan, field, admin, dan data peserta absensi event.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [settings, setSettings] = useState<AbsensiSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  const q = useQuery({
    queryKey: ["absensi-event", id],
    queryFn: () => getAbsensiAdminEvent({ data: { id } }),
  });

  useEffect(() => {
    if (!q.data) return;
    setSettings(q.data.event as AbsensiSettings);
  }, [q.data]);

  function update<K extends keyof AbsensiSettings>(key: K, value: AbsensiSettings[K]) {
    setSettings((s) => (s ? { ...s, [key]: value } : s));
  }

  function toggleField(key: keyof AbsensiFields) {
    setSettings((s) => (s ? { ...s, fields: { ...s.fields, [key]: !s.fields[key] } } : s));
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      const { id: _omit, ...rest } = settings;
      await saveAbsensiEvent({ data: { ...rest, id: settings.id } });
      toast.success("Pengaturan tersimpan");
      void q.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan");
    }
    setSaving(false);
  }

  const entries = (q.data?.entries ?? []) as AbsensiEntry[];
  const panel = q.data?.panel ?? false;
  const shareUrl = settings
    ? `${typeof window === "undefined" ? "" : window.location.origin}/absensi/${settings.slug}`
    : "";

  return (
    <AdminPage menuKey="tools">
      {q.isLoading || !settings ? (
        <p className="text-sm text-muted-foreground">Memuat...</p>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Button asChild variant="ghost" size="sm" className="mb-1 -ml-2">
                <Link to="/admin/tools/absensi">
                  <ArrowLeft className="size-4" /> Kembali
                </Link>
              </Button>
              <h1 className="text-2xl font-bold">{settings.eventName}</h1>
              <p className="text-sm text-muted-foreground">
                {settings.officeName} · {formatDateID(settings.eventDate)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  void navigator.clipboard.writeText(shareUrl);
                  toast.success("Link absensi disalin");
                }}
              >
                <Copy className="size-4" /> Salin link
              </Button>
              <Button variant="secondary" onClick={() => setQrOpen(true)}>
                <QrCode className="size-4" /> Generate QR
              </Button>
              <Button asChild variant="secondary">
                <a href={shareUrl} target="_blank" rel="noreferrer">
                  Buka form
                </a>
              </Button>
              {panel ? (
                <Button
                  variant="destructive"
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Hapus absensi event?",
                      description:
                        "Semua data peserta dan foto selfie di Google Drive ikut terhapus.",
                      destructive: true,
                    });
                    if (!ok) return;
                    await deleteAbsensiEvent({ data: { id } });
                    toast.success("Absensi event dihapus");
                    void navigate({ to: "/admin/tools/absensi" });
                  }}
                >
                  <Trash2 className="size-4" /> Hapus event
                </Button>
              ) : null}
            </div>
          </div>

          <div className="glass-card space-y-2 p-4">
            <Label>Link absensi untuk dibagikan</Label>
            <Input readOnly value={shareUrl} onFocus={(e) => e.currentTarget.select()} />
          </div>

          <section className="glass-card space-y-4 p-5">
            <h2 className="font-semibold">Identitas Acara</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Nama Acara</Label>
                <Input
                  value={settings.eventName}
                  onChange={(e) => update("eventName", e.target.value)}
                />
              </div>
              <div>
                <Label>Nama Kantor</Label>
                <Input
                  value={settings.officeName}
                  onChange={(e) => update("officeName", e.target.value)}
                />
              </div>
              <div>
                <Label>Tanggal Acara</Label>
                <DatePickerField
                  value={settings.eventDate}
                  onChange={(v) => update("eventDate", v)}
                />
              </div>
              <div>
                <Label>Slug link</Label>
                <Input value={settings.slug} onChange={(e) => update("slug", e.target.value)} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.isOpen}
                onChange={(e) => update("isOpen", e.target.checked)}
              />
              Absensi dibuka (peserta bisa mengisi form)
            </label>
          </section>

          <section className="glass-card space-y-4 p-5">
            <h2 className="font-semibold">Tampilan</h2>
            <AbsensiDisplayEditor
              value={settings}
              onChange={(patch) => setSettings((s) => (s ? { ...s, ...patch } : s))}
            />
          </section>

          <section className="glass-card space-y-3 p-5">
            <h2 className="font-semibold">Field yang diambil di form absensi</h2>
            {(Object.keys(absensiFieldLabels) as (keyof AbsensiFields)[]).map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!settings.fields[key]}
                  onChange={() => toggleField(key)}
                />
                {absensiFieldLabels[key]}
              </label>
            ))}
          </section>

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan Pengaturan"}
            </Button>
          </div>

          <section className="glass-card space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">
                Data Absensi · {entries.length} peserta
              </h2>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => exportAbsensiJSON(entries)}>
                  JSON
                </Button>
                <Button size="sm" variant="secondary" onClick={() => exportAbsensiExcel(entries)}>
                  Excel
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => exportAbsensiPDF(entries, `${settings.eventName} — Data Absensi`)}
                >
                  PDF
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Hapus semua data absensi?",
                      description:
                        "Data peserta dan foto selfie di Google Drive akan dihapus permanen.",
                      destructive: true,
                    });
                    if (!ok) return;
                    await clearAbsensiEntries({ data: { eventId: id } });
                    toast.success("Data absensi dihapus");
                    void q.refetch();
                  }}
                >
                  Hapus semua
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="p-2">Waktu</th>
                    <th className="p-2">Nama</th>
                    <th className="p-2">Personal Number</th>
                    <th className="p-2">Unit Kerja</th>
                    <th className="p-2">No. Telp</th>
                    <th className="p-2">Foto</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.length === 0 ? (
                    <tr>
                      <td className="p-3 text-muted-foreground" colSpan={7}>
                        Belum ada data absensi.
                      </td>
                    </tr>
                  ) : (
                    entries
                      .slice()
                      .reverse()
                      .map((row) => (
                        <tr key={row.id} className="border-t border-border/60">
                          <td className="p-2">
                            {new Date(row.submittedAt).toLocaleString("id-ID")}
                          </td>
                          <td className="p-2">{row.nama || "-"}</td>
                          <td className="p-2">{row.personalNumber || "-"}</td>
                          <td className="p-2">{row.unitKerja || "-"}</td>
                          <td className="p-2">{row.noTelp || "-"}</td>
                          <td className="p-2">
                            {row.photoThumbnailUrl ? (
                              <a href={row.photoUrl ?? "#"} target="_blank" rel="noreferrer">
                                <img
                                  src={row.photoThumbnailUrl}
                                  alt={`Foto selfie ${row.nama || "peserta"}`}
                                  className="size-9 rounded-md object-cover"
                                />
                              </a>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="p-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={async () => {
                                const ok = await confirm({
                                  title: "Hapus data peserta ini?",
                                  destructive: true,
                                });
                                if (!ok) return;
                                await deleteAbsensiEntry({
                                  data: { eventId: id, entryId: row.id },
                                });
                                void q.refetch();
                              }}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <QrCodeDialog
            open={qrOpen}
            onOpenChange={setQrOpen}
            url={shareUrl}
            title={`QR Absensi — ${settings.eventName}`}
            fileName={`qr-absensi-${settings.eventName}`}
            eventName={settings.eventName}
            dateText={formatDateID(settings.eventDate)}
            locationText={settings.officeName}
          />
        </div>
      )}
    </AdminPage>
  );
}
