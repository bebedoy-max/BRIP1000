import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Link2, Plus, Trash2, Video } from "lucide-react";
import { toast } from "sonner";
import { AdminPage } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { DatePickerField } from "@/components/DatePickerField";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  createZoomMeeting,
  deleteZoomMeeting,
  getZoomStatus,
  saveZoomCredentials,
} from "@/lib/zoom.functions";

export const Route = createFileRoute("/_authenticated/admin/tools/zoom/")({
  head: () => ({
    meta: [
      { title: "Zoom Meeting — SuperIT Apps" },
      {
        name: "description",
        content:
          "Buat dan kelola jadwal Zoom Meeting langsung dari panel BRI BO Pringsewu, lengkap dengan tautan undangan.",
      },
      { property: "og:title", content: "Zoom Meeting — SuperIT Apps" },
      {
        property: "og:description",
        content: "Penjadwalan Zoom Meeting dari panel BRI BO Pringsewu.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

function durationLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h} jam`;
  return `${h} jam ${m} menit`;
}

const DURATION_OPTIONS = (() => {
  const opts: number[] = [];
  for (let min = 60; min <= 180; min += 30) opts.push(min);
  for (let min = 240; min <= 720; min += 60) opts.push(min);
  return opts;
})();

const emptyForm = {
  topic: "",
  agenda: "",
  startTime: "",
  duration: 60,
  timezone: "Asia/Jakarta",
  password: "",
};

function formatWaktu(iso: string, tz: string) {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: tz || "Asia/Jakarta",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatInviteTime(iso: string, tz: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: tz || "Asia/Jakarta",
      timeZoneName: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatMeetingId(id: string | null) {
  if (!id) return null;
  const digits = id.replace(/\D/g, "");
  return digits.replace(/(\d{3})(\d{4})(\d{4})/, "$1 $2 $3");
}

/** Format undangan ala Zoom saat tombol Salin diklik. */
function buildInviteText(m: {
  topic: string;
  start_time: string;
  timezone: string;
  join_url: string | null;
  zoom_meeting_id: string | null;
  password: string | null;
}) {
  const lines = [
    "BO PRINGSEWU is inviting you to a scheduled Zoom meeting.",
    "",
    `Topic: ${m.topic}`,
    `Time: ${formatInviteTime(m.start_time, m.timezone)}`,
    "",
    "Join Zoom Meeting",
    m.join_url ?? "",
  ];
  const mid = formatMeetingId(m.zoom_meeting_id);
  if (mid) lines.push("", `Meeting ID: ${mid}`);
  if (m.password) lines.push(`Passcode: ${m.password}`);
  return lines.join("\n");
}

function Page() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const status = useQuery({ queryKey: ["zoom-status"], queryFn: () => getZoomStatus() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [cred, setCred] = useState({ clientId: "", clientSecret: "", redirectUri: "" });

  useEffect(() => {
    if (!status.data) return;
    setCred((c) => ({
      clientId: c.clientId || status.data.clientId,
      clientSecret: c.clientSecret,
      redirectUri: c.redirectUri || status.data.redirectUri,
    }));
  }, [status.data]);

  const saveCred = useMutation({
    mutationFn: () => saveZoomCredentials({ data: cred }),
    onSuccess: () => {
      toast.success("Kredensial Zoom tersimpan.");
      void qc.invalidateQueries({ queryKey: ["zoom-status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const create = useMutation({
    mutationFn: () => createZoomMeeting({ data: { ...form, duration: Number(form.duration) || 60 } }),
    onSuccess: () => {
      toast.success("Jadwal Zoom Meeting dibuat.");
      setOpen(false);
      setForm(emptyForm);
      void qc.invalidateQueries({ queryKey: ["zoom-status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteZoomMeeting({ data: { id } }),
    onSuccess: () => {
      toast.success("Jadwal dihapus.");
      void qc.invalidateQueries({ queryKey: ["zoom-status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const data = status.data;
  const meetings = data?.meetings ?? [];

  return (
    <AdminPage menuKey="tools">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Video className="size-6" /> Zoom Meeting
            </h1>
            <p className="text-sm text-muted-foreground">
              Buat jadwal Zoom Meeting langsung dari panel, lalu bagikan tautan undangannya.
            </p>
          </div>
          <Button onClick={() => setOpen(true)} disabled={!data?.connected}>
            <Plus className="size-4" /> Buat Jadwal
          </Button>
        </div>

        <div className="glass-card space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">Koneksi Zoom</h2>
            {data?.connected ? (
              <Badge>Terhubung{data.accountEmail ? ` — ${data.accountEmail}` : ""}</Badge>
            ) : (
              <Badge variant="secondary">Belum terhubung</Badge>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="zoom-client">Client ID</Label>
              <Input
                id="zoom-client"
                value={cred.clientId}
                onChange={(e) => setCred((c) => ({ ...c, clientId: e.target.value }))}
                placeholder="Pitq8flYR7GhBo_O3clokg"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="zoom-secret">Client Secret</Label>
              <Input
                id="zoom-secret"
                type="password"
                value={cred.clientSecret}
                onChange={(e) => setCred((c) => ({ ...c, clientSecret: e.target.value }))}
                placeholder={data?.configured ? "•••••• (kosongkan bila tidak diubah)" : "Client secret Zoom"}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="zoom-redirect">Redirect URL (samakan dengan Zoom App)</Label>
              <Input
                id="zoom-redirect"
                value={cred.redirectUri}
                onChange={(e) => setCred((c) => ({ ...c, redirectUri: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => saveCred.mutate()} disabled={saveCred.isPending}>
              Simpan Kredensial
            </Button>
            <Button
              disabled={!data?.authorizeUrl}
              onClick={() => data?.authorizeUrl && window.open(data.authorizeUrl, "_blank", "noopener")}
            >
              <Link2 className="size-4" /> Hubungkan Zoom
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {status.isLoading ? (
            <p className="text-sm text-muted-foreground">Memuat…</p>
          ) : meetings.length === 0 ? (
            <div className="glass-card p-8 text-center text-sm text-muted-foreground">
              Belum ada jadwal Zoom Meeting.
            </div>
          ) : (
            meetings.map((m) => (
              <div key={m.id} className="glass-card space-y-2 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{m.topic}</h3>
                    <p className="text-sm text-muted-foreground">
                      {formatWaktu(m.start_time, m.timezone)} • {m.duration} menit
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {m.join_url ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            void navigator.clipboard.writeText(buildInviteText(m));
                            toast.success("Undangan meeting disalin.");
                          }}
                        >
                          <Copy className="size-4" /> Salin
                        </Button>
                        <Button size="sm" variant="outline" asChild>
                          <a href={m.join_url} target="_blank" rel="noreferrer">
                            <ExternalLink className="size-4" /> Buka
                          </a>
                        </Button>
                      </>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        if (await confirm({ title: "Hapus jadwal ini?" })) remove.mutate(m.id);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                {m.agenda ? <p className="text-sm text-muted-foreground">{m.agenda}</p> : null}
                {m.password ? (
                  <p className="text-xs text-muted-foreground">Passcode: {m.password}</p>
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buat Jadwal Zoom Meeting</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="topic">Topik</Label>
              <Input
                id="topic"
                value={form.topic}
                onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="agenda">Agenda (opsional)</Label>
              <Textarea
                id="agenda"
                value={form.agenda}
                onChange={(e) => setForm((f) => ({ ...f, agenda: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="start">Tanggal</Label>
                <DatePickerField
                  id="start"
                  value={form.startTime.slice(0, 10)}
                  onChange={(v) =>
                    setForm((f) => ({ ...f, startTime: v ? `${v}T${f.startTime.slice(11, 16) || "00:00"}` : "" }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="start-hour">Jam</Label>
                <Select
                  value={form.startTime ? form.startTime.slice(11, 13) : ""}
                  onValueChange={(h) =>
                    setForm((f) => ({
                      ...f,
                      startTime: `${f.startTime.slice(0, 10) || format(new Date(), "yyyy-MM-dd")}T${h}:${f.startTime.slice(14, 16) || "00"}`,
                    }))
                  }
                >
                  <SelectTrigger id="start-hour">
                    <SelectValue placeholder="Jam" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {HOURS.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="start-minute">Menit</Label>
                <Select
                  value={form.startTime ? form.startTime.slice(14, 16) : ""}
                  onValueChange={(m) =>
                    setForm((f) => ({
                      ...f,
                      startTime: `${f.startTime.slice(0, 10) || format(new Date(), "yyyy-MM-dd")}T${f.startTime.slice(11, 13) || "00"}:${m}`,
                    }))
                  }
                >
                  <SelectTrigger id="start-minute">
                    <SelectValue placeholder="Menit" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {MINUTES.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="duration">Durasi</Label>
                <Select
                  value={String(form.duration)}
                  onValueChange={(v) => setForm((f) => ({ ...f, duration: Number(v) }))}
                >
                  <SelectTrigger id="duration">
                    <SelectValue placeholder="Pilih durasi" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {DURATION_OPTIONS.map((min) => (
                      <SelectItem key={min} value={String(min)}>
                        {durationLabel(min)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Passcode (opsional)</Label>
                <Input
                  id="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              Simpan Jadwal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}
