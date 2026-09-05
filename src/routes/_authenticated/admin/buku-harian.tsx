import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Download, Images, Pencil, Plus, Trash2 } from "lucide-react";
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
import { DatePickerField } from "@/components/DatePickerField";
import { PhotoGallery } from "@/components/PhotoGallery";
import { useConfirm } from "@/components/ConfirmDialog";
import { supabase } from "@/lib/supabase";
import { useDirectory } from "@/lib/directory";
import { RotatingThumbGrid } from "@/components/RotatingThumbGrid";
import { loadDiaryPhotos } from "@/components/DiarySummary";
import { maskSensitiveText } from "@/lib/maskSensitive";

const db = supabase as unknown as SupabaseClient;

export const Route = createFileRoute("/_authenticated/admin/buku-harian")({
  head: () => ({
    meta: [
      { title: "Buku Harian IT — Panel BRI BO Pringsewu" },
      {
        name: "description",
        content: "Catatan kegiatan harian petugas IT beserta problem, solusi, dan foto kegiatan.",
      },
      { property: "og:title", content: "Buku Harian IT — Panel BRI BO Pringsewu" },
      {
        property: "og:description",
        content: "Catatan kegiatan harian petugas IT beserta problem, solusi, dan foto kegiatan.",
      },
    ],
  }),
  component: Page,
});

type DiaryRow = {
  id: string;
  user_id: string;
  tanggal: string;
  nama_kegiatan: string;
  detil_problem: string | null;
  solusi: string | null;
  status: string;
  keterangan: string | null;
  created_at: string;
  updated_at: string | null;
};

const STATUS = ["Done", "In Progress", "Failed"] as const;

function statusVariant(s: string): "default" | "secondary" | "destructive" {
  if (s === "Done") return "default";
  if (s === "Failed") return "destructive";
  return "secondary";
}

function iso(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function rangeFor(mode: string): { from: string; to: string } {
  const now = new Date();
  if (mode === "hari") return { from: iso(now), to: iso(now) };
  if (mode === "minggu") {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    return { from: iso(start), to: iso(now) };
  }
  if (mode === "bulan") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: iso(start), to: iso(now) };
  }
  return { from: iso(now), to: iso(now) };
}

function tanggalLabel(v: string) {
  const d = new Date(`${v}T00:00:00`);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/** Jam format 24 jam, mis. "14.30 WIB". */
function jamLabel(isoStr: string | null | undefined) {
  if (!isoStr) return null;
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}.${pad(d.getMinutes())} WIB`;
}

/** Label last update, mis. "Last update 28 Agu 2026 · 14.30 WIB". */
function lastUpdateLabel(r: DiaryRow) {
  const src = r.updated_at ?? r.created_at;
  const d = new Date(src);
  if (Number.isNaN(d.getTime())) return null;
  const tgl = d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return `Last update ${tgl} · ${jamLabel(src)}`;
}

type DiaryForm = Omit<DiaryRow, "id" | "user_id" | "created_at" | "updated_at">;

function emptyForm(): DiaryForm {
  return {
    tanggal: iso(new Date()),
    nama_kegiatan: "",
    detil_problem: "",
    solusi: "",
    status: "In Progress",
    keterangan: "",
  };
}

function Page() {
  return (
    <AdminPage menuKey="buku-harian">
      <Content />
    </AdminPage>
  );
}

function Content() {
  const dir = useDirectory();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const myId = dir.myId;
  const isPetugasIt = dir.isPetugasIt;
  const isManajemen = dir.isManajemen;

  const [mode, setMode] = useState("minggu");
  const [custom, setCustom] = useState(() => rangeFor("minggu"));
  const range = mode === "rentang" ? custom : rangeFor(mode);
  const [petugas, setPetugas] = useState("all");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DiaryRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [photoRow, setPhotoRow] = useState<DiaryRow | null>(null);

  const list = useQuery({
    queryKey: ["it_diary_logs", range.from, range.to, isManajemen ? "all" : myId],
    enabled: !!myId,
    queryFn: async () => {
      let q = db
        .from("it_diary_logs")
        .select(
          "id,user_id,tanggal,nama_kegiatan,detil_problem,solusi,status,keterangan,created_at,updated_at",
        )
        .gte("tanggal", range.from)
        .lte("tanggal", range.to);
      // Petugas IT hanya melihat catatannya sendiri; manajemen melihat semua.
      if (!isManajemen) q = q.eq("user_id", myId);
      const { data, error } = await q
        .order("tanggal", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DiaryRow[];
    },
  });

  const photoMap = useQuery({
    queryKey: ["it_diary_photos", (list.data ?? []).map((r) => r.id).join(",")],
    enabled: !!(list.data ?? []).length,
    queryFn: () => loadDiaryPhotos((list.data ?? []).map((r) => r.id)),
  });

  const nameOf = dir.nameOf;

  const rows = useMemo(
    () => (list.data ?? []).filter((r) => petugas === "all" || r.user_id === petugas),
    [list.data, petugas],
  );

  /** Daftar petugas IT dari direktori (akun ↔ Data Pekerja ↔ jabatan). */
  const petugasOptions = useMemo(() => {
    const ids = new Set<string>((list.data ?? []).map((r) => r.user_id));
    for (const e of dir.entries) if (e.is_petugas_it) ids.add(e.user_id);
    return [...ids]
      .map((id) => {
        const e = dir.byId.get(id);
        return { id, label: nameOf(id), jabatan: e?.jabatan ?? null };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [list.data, dir.entries, dir.byId, nameOf]);

  /** Kelompokkan per petugas lalu per tanggal. */
  const grouped = useMemo(() => {
    const byUser = new Map<string, Map<string, DiaryRow[]>>();
    for (const r of rows) {
      const perUser = byUser.get(r.user_id) ?? new Map<string, DiaryRow[]>();
      perUser.set(r.tanggal, [...(perUser.get(r.tanggal) ?? []), r]);
      byUser.set(r.user_id, perUser);
    }
    return [...byUser.entries()].map(([userId, days]) => ({
      userId,
      nama: nameOf(userId),
      jabatan: dir.byId.get(userId)?.jabatan ?? null,
      uker: dir.byId.get(userId)?.uker ?? null,
      days: [...days.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)),
    }));
  }, [rows, nameOf, dir.byId]);


  const save = useMutation({
    mutationFn: async () => {
      if (!form.nama_kegiatan.trim()) throw new Error("Nama kegiatan wajib diisi");
      const payload = {
        tanggal: form.tanggal || iso(new Date()),
        nama_kegiatan: form.nama_kegiatan.trim(),
        detil_problem: form.detil_problem || null,
        solusi: form.solusi || null,
        status: form.status,
        keterangan: form.keterangan || null,
      };
      if (editing) {
        const { error } = await db.from("it_diary_logs").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await db.from("it_diary_logs").insert({ ...payload, user_id: myId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Catatan tersimpan");
      setOpen(false);
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ["it_diary_logs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("it_diary_logs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Catatan dihapus");
      void qc.invalidateQueries({ queryKey: ["it_diary_logs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function startAdd() {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  }

  function startEdit(r: DiaryRow) {
    setEditing(r);
    setForm({
      tanggal: r.tanggal,
      nama_kegiatan: r.nama_kegiatan,
      detil_problem: r.detil_problem ?? "",
      solusi: r.solusi ?? "",
      status: r.status,
      keterangan: r.keterangan ?? "",
    });
    setOpen(true);
  }

  function downloadPdf() {
    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const body = grouped
      .map(
        (g) => `
        <h2>${esc(g.nama)}</h2>
        ${g.days
          .map(
            ([tgl, items]) => `
          <h3>${esc(tanggalLabel(tgl))}</h3>
          <table>
            <thead><tr><th>Kegiatan</th><th>Detil Problem</th><th>Solusi &amp; Penyelesaian</th><th>Status</th><th>Keterangan</th></tr></thead>
            <tbody>
              ${items
                .map(
                  (i) => `<tr>
                    <td>${esc(i.nama_kegiatan)}</td>
                    <td>${esc(maskSensitiveText(i.detil_problem) || "-")}</td>
                    <td>${esc(maskSensitiveText(i.solusi) || "-")}</td>
                    <td>${esc(i.status)}</td>
                    <td>${esc(maskSensitiveText(i.keterangan) || "-")}</td>
                  </tr>`,
                )
                .join("")}
            </tbody>
          </table>`,
          )
          .join("")}`,
      )
      .join("");

    const html = `<!doctype html><html lang="id"><head><meta charset="utf-8">
      <title>Buku Harian IT ${range.from} s.d. ${range.to}</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:24px}
        h1{font-size:18px;margin:0 0 4px}
        h2{font-size:15px;margin:20px 0 4px;border-bottom:2px solid #0b5ed7;padding-bottom:4px}
        h3{font-size:13px;margin:12px 0 4px;color:#0b5ed7}
        p.meta{font-size:12px;color:#555;margin:0 0 12px}
        table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:8px}
        th,td{border:1px solid #bbb;padding:6px;text-align:left;vertical-align:top}
        th{background:#eef4ff}
        @page{size:A4 landscape;margin:12mm}
      </style></head><body>
      <h1>Laporan Buku Harian IT</h1>
      <p class="meta">Periode: ${range.from} s.d. ${range.to} — dicetak ${new Date().toLocaleString("id-ID")}</p>
      ${body || "<p>Tidak ada catatan pada periode ini.</p>"}
      <script>window.onload=()=>{window.print()}<\/script>
      </body></html>`;

    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Izinkan pop up untuk mengunduh PDF");
      return;
    }
    w.document.write(html);
    w.document.close();
  }

  return (
    <div className="space-y-4">
      <div className="glass-card flex flex-wrap items-end justify-between gap-3 p-4">
        <div>
          <h1 className="text-lg font-semibold">Buku Harian IT</h1>
          <p className="text-sm text-muted-foreground">
            {isManajemen
              ? "Manajemen: melihat kegiatan harian seluruh petugas IT."
              : "Catatan kegiatan harian Anda sebagai petugas IT."}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Masuk sebagai <span className="text-foreground">{dir.me?.nama ?? "—"}</span>
            {dir.me?.personal_number ? ` (PN ${dir.me.personal_number})` : ""}
            {dir.me?.jabatan ? ` — ${dir.me.jabatan}` : ""} · Level {dir.myLevelLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Button variant="outline" onClick={downloadPdf}>
            <Download className="size-4" /> Download PDF
          </Button>
          {isPetugasIt ? (
            <Button onClick={startAdd}>
              <Plus className="size-4" /> Tambah Catatan
            </Button>
          ) : null}
        </div>
      </div>

      <div className="glass-card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <Label>Rentang</Label>
          <Select
            value={mode}
            onValueChange={(v) => {
              setMode(v);
              if (v === "rentang") setCustom(rangeFor("minggu"));
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hari">Hari ini</SelectItem>
              <SelectItem value="minggu">7 hari terakhir</SelectItem>
              <SelectItem value="bulan">Bulan ini</SelectItem>
              <SelectItem value="rentang">Rentang tanggal</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Dari</Label>
          <DatePickerField
            value={range.from}
            onChange={(v) => {
              setMode("rentang");
              setCustom((c) => ({ ...c, from: v }));
            }}
          />
        </div>
        <div className="space-y-1">
          <Label>Sampai</Label>
          <DatePickerField
            value={range.to}
            onChange={(v) => {
              setMode("rentang");
              setCustom((c) => ({ ...c, to: v }));
            }}
          />
        </div>
        <div className="space-y-1">
          <Label>Petugas IT</Label>
          <Select value={petugas} onValueChange={setPetugas}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua petugas</SelectItem>
              {petugasOptions.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                  {p.jabatan ? ` — ${p.jabatan}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {list.isLoading ? (
        <p className="text-sm text-muted-foreground">Memuat catatan…</p>
      ) : grouped.length === 0 ? (
        <div className="glass-card p-10 text-center text-sm text-muted-foreground">
          Belum ada catatan pada periode ini.
        </div>
      ) : (
        grouped.map((g) => (
          <div key={g.userId} className="glass-card space-y-4 p-4">
            {g.days.map(([tgl, items]) => (
              <div key={tgl} className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{tanggalLabel(tgl)}</p>
                <div className="grid gap-2">
                  {items.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-2xl border border-border/60 bg-secondary/20 p-4 transition-colors hover:border-primary/40"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row">
                        <div className="min-w-0 flex-1 space-y-2">
                          {/* Baris kepala: pill identitas (kolom label) + pill kegiatan */}
                          <div className="flex items-start gap-3">
                            <div className="w-40 shrink-0 rounded-2xl bg-secondary/70 px-4 py-2 text-left">
                              <p className="border-b border-foreground/40 pb-0.5 text-sm font-semibold leading-tight">
                                {g.nama}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {[g.jabatan, g.uker].filter(Boolean).join(" · ") || "Petugas IT"}
                              </p>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="rounded-2xl bg-secondary/70 px-4 py-2 text-sm font-semibold">
                                {r.nama_kegiatan}
                              </div>
                              <p className="mt-1 pl-4 text-left text-xs font-semibold text-muted-foreground">
                                {jamLabel(r.created_at) ? `Open - ${jamLabel(r.created_at)}` : ""}
                              </p>
                            </div>
                            <div className="flex shrink-0 gap-1">
                              <Button variant="ghost" size="icon" onClick={() => setPhotoRow(r)}>
                                <Images className="size-4" />
                              </Button>
                              {r.user_id === myId ? (
                                <>
                                  <Button variant="ghost" size="icon" onClick={() => startEdit(r)}>
                                    <Pencil className="size-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={async () => {
                                      const ok = await confirm({
                                        title: "Hapus catatan?",
                                        description: r.nama_kegiatan,
                                        destructive: true,
                                      });
                                      if (ok) remove.mutate(r.id);
                                    }}
                                  >
                                    <Trash2 className="size-4" />
                                  </Button>
                                </>
                              ) : null}
                            </div>
                          </div>

                          {/* Last update + status, rata kanan di atas baris detail */}
                          <div className="flex items-center justify-end gap-2 text-xs font-semibold text-muted-foreground">
                            <span>{lastUpdateLabel(r) ?? tanggalLabel(tgl)}</span>
                            <Badge variant={statusVariant(r.status)} className="text-[10px]">
                              {r.status}
                            </Badge>
                          </div>

                          <dl className="space-y-2 text-sm">
                            {[
                              ["Detil Problem", r.detil_problem],
                              ["Penyelesaian", r.solusi],
                              ["Keterangan", r.keterangan],
                            ].map(([label, value]) => (
                              <div key={label} className="flex items-stretch gap-3">
                                <dt className="flex w-40 shrink-0 items-center pl-[16px] text-left text-xs font-semibold">
                                  {label}
                                </dt>
                                <dd className="min-w-0 flex-1 whitespace-pre-wrap rounded-2xl bg-secondary/60 px-4 py-3">
                                  {maskSensitiveText(value as string) || "-"}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </div>

                        <RotatingThumbGrid
                          photos={photoMap.data?.[r.id] ?? []}
                          alt={`Foto kegiatan ${r.nama_kegiatan}`}
                          className="w-full shrink-0 self-stretch lg:w-64"
                        />
                      </div>

                    </div>

                  ))}
                </div>
              </div>
            ))}
          </div>
        ))
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Ubah Catatan" : "Tambah Catatan"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label htmlFor="tanggal">Tanggal</Label>
              <DatePickerField
                id="tanggal"
                value={form.tanggal}
                onChange={(v) => setForm((f) => ({ ...f, tanggal: v }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="kegiatan">Nama Kegiatan</Label>
              <Input
                id="kegiatan"
                value={form.nama_kegiatan}
                onChange={(e) => setForm((f) => ({ ...f, nama_kegiatan: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="problem">Detil Problem</Label>
              <Textarea
                id="problem"
                value={form.detil_problem ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, detil_problem: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="solusi">Solusi &amp; Deskripsi Penyelesaian</Label>
              <Textarea
                id="solusi"
                value={form.solusi ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, solusi: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="keterangan">Keterangan</Label>
              <Textarea
                id="keterangan"
                value={form.keterangan ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, keterangan: e.target.value }))}
              />
            </div>
            {editing ? (
              <PhotoGallery
                entity="buku-harian"
                entityId={editing.id}
                canEdit
                title="Foto Kegiatan"
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                Simpan catatan terlebih dahulu untuk menambahkan foto kegiatan.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!photoRow} onOpenChange={(v) => !v && setPhotoRow(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Foto Kegiatan — {photoRow?.nama_kegiatan}</DialogTitle>
          </DialogHeader>
          {photoRow ? (
            <PhotoGallery
              entity="buku-harian"
              entityId={photoRow.id}
              canEdit={photoRow.user_id === myId}
              title="Foto Kegiatan"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
