import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image as ImageIcon, Loader2, Plus, Save, Sunrise, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { AdminPage } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  defaultDoaLogos,
  doaLogoLabels,
  isQrisFilled,
  normalizeDoaLogos,
  toIsoDate,

  type DoaLogoKey,
  type DoaLogoSettings,
  type DoaPagiSection,
} from "@/lib/doa-pagi-ui";
import {
  deleteDoaPagiSection,
  getDoaPagiLogos,
  getDoaPagiReport,
  getDoaPagiSettings,
  saveDoaPagiLogos,
  saveDoaPagiSection,
} from "@/lib/doa-pagi.functions";
import logoBo from "@/assets/doa/b1000.png";
import logoBri from "@/assets/doa/bri.png";
import logoDanantara from "@/assets/doa/danantara.png";

const fallbackLogo: Record<DoaLogoKey, string> = {
  bo: logoBo,
  danantara: logoDanantara,
  bri: logoBri,
};

/** Editor logo header tampilan absensi: ganti gambar, ukuran, dan posisi. */
function LogoSettings() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["doa-pagi", "logos"], queryFn: () => getDoaPagiLogos() });
  const [draft, setDraft] = useState<DoaLogoSettings | null>(null);
  const logos = draft ?? q.data?.logos ?? defaultDoaLogos;

  const save = useMutation({
    mutationFn: (value: DoaLogoSettings) => saveDoaPagiLogos({ data: { logos: value } }),
    onSuccess: async () => {
      toast.success("Pengaturan logo tersimpan.");
      setDraft(null);
      await qc.invalidateQueries({ queryKey: ["doa-pagi", "logos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function patch(key: DoaLogoKey, part: Partial<DoaLogoSettings[DoaLogoKey]>) {
    setDraft(normalizeDoaLogos({ ...logos, [key]: { ...logos[key], ...part } }));
  }

  function pickFile(key: DoaLogoKey, file: File | null) {
    if (!file) return;
    if (file.size > 400_000) {
      toast.error("Ukuran gambar maksimal 400 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => patch(key, { url: String(reader.result) });
    reader.readAsDataURL(file);
  }

  return (
    <div className="glass-card space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <ImageIcon className="size-4" /> Logo Tampilan Absensi
          </h2>
          <p className="text-sm text-muted-foreground">
            Ganti gambar, atur ukuran, dan geser posisi logo BRI, Danantara, serta BO Pringsewu.
          </p>
        </div>
        <Button onClick={() => save.mutate(logos)} disabled={save.isPending}>
          {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Simpan Logo
        </Button>
      </div>

      {q.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Memuat pengaturan logo…
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {(Object.keys(doaLogoLabels) as DoaLogoKey[]).map((key) => {
            const l = logos[key];
            return (
              <div key={key} className="space-y-3 rounded-xl border border-input p-3">
                <p className="text-sm font-medium">{doaLogoLabels[key]}</p>
                <div className="flex h-24 items-center justify-center overflow-hidden rounded-lg bg-[#1b1558]">
                  <img
                    src={l.url ?? fallbackLogo[key]}
                    alt={doaLogoLabels[key]}
                    className="object-contain"
                    style={{
                      height: `${l.height}px`,
                      maxHeight: `${l.height}px`,
                      transform: `translate(${l.x}px, ${l.y}px)`,
                    }}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    className="h-9 flex-1 text-xs"
                    onChange={(e) => pickFile(key, e.target.files?.[0] ?? null)}
                  />
                  {l.url ? (
                    <Button variant="ghost" size="sm" onClick={() => patch(key, { url: null })}>
                      Reset
                    </Button>
                  ) : null}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs" htmlFor={`h-${key}`}>
                      Tinggi (px)
                    </Label>
                    <Input
                      id={`h-${key}`}
                      type="number"
                      min={12}
                      max={220}
                      value={l.height}
                      onChange={(e) => patch(key, { height: Number(e.target.value) || 12 })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs" htmlFor={`x-${key}`}>
                      Geser X
                    </Label>
                    <Input
                      id={`x-${key}`}
                      type="number"
                      min={-300}
                      max={300}
                      value={l.x}
                      onChange={(e) => patch(key, { x: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs" htmlFor={`y-${key}`}>
                      Geser Y
                    </Label>
                    <Input
                      id={`y-${key}`}
                      type="number"
                      min={-300}
                      max={300}
                      value={l.y}
                      onChange={(e) => patch(key, { y: Number(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Nilai X negatif menggeser ke kiri, Y negatif ke atas.
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const monthNames = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

/** Daftar bulan (12 bulan terakhir) sebagai nilai YYYY-MM. */
function monthOptions(): { value: string; label: string }[] {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { value, label: `${monthNames[d.getMonth()]} ${d.getFullYear()}` };
  });
}

function monthRange(value: string) {
  const [y, m] = value.split("-").map(Number);
  const first = new Date(y!, (m ?? 1) - 1, 1);
  const last = new Date(y!, m ?? 1, 0);
  return { from: toIsoDate(first), to: toIsoDate(last) };
}

/** Rekap jumlah izin, sakit, terlambat, dan tanpa keterangan per pekerja. */
function ReportPanel({ ukers }: { ukers: { id: string; nama: string }[] }) {
  const months = useMemo(() => monthOptions(), []);
  const [ukerId, setUkerId] = useState("");
  const [bulan, setBulan] = useState(months[0]!.value);
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [format, setFormat] = useState<"csv" | "xlsx" | "pdf">("pdf");

  const activeUkerId = ukerId || ukers[0]?.id || "";
  const activeUker = ukers.find((u) => u.id === activeUkerId);

  const { from, to } = useMemo(() => {
    if (customFrom && customTo) return { from: customFrom, to: customTo };
    return monthRange(bulan);
  }, [bulan, customFrom, customTo]);

  const q = useQuery({
    queryKey: ["doa-pagi", "report", activeUkerId, from, to],
    enabled: !!activeUkerId,
    queryFn: () => getDoaPagiReport({ data: { ukerId: activeUkerId, from, to } }),
  });

  const sections = q.data?.sections ?? [];
  const employees = q.data?.employees ?? [];
  const jabatanMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of employees) map.set(e.nama, e.jabatan);
    return map;
  }, [employees]);

  /** Satu baris rekap per pekerja pada unit kerja terpilih. */
  const rows = useMemo(() => {
    const map = new Map<
      string,
      {
        nama: string;
        jabatan: string;
        izin: number;
        sakit: number;
        terlambat: number;
        tanpa: number;
      }
    >();
    for (const s of sections)
      for (const p of s.pekerja)
        if (!map.has(`${s.id}|${p}`))
          map.set(`${s.id}|${p}`, {
            nama: p,
            jabatan: jabatanMap.get(p) ?? "-",
            izin: 0,
            sakit: 0,
            terlambat: 0,
            tanpa: 0,
          });
    for (const r of q.data?.records ?? []) {
      const row = map.get(`${r.sectionId}|${r.pekerja}`);
      if (!row) continue;
      const k = r.kehadiran.toLowerCase();
      if (k === "izin" || k === "cuti") row.izin += 1;
      else if (k === "sakit") row.sakit += 1;
      else if (k === "tanpa keterangan" || k === "belum hadir") row.tanpa += 1;
      // Hadir namun tidak melakukan absen QRIS dihitung sebagai terlambat.
      else if (!isQrisFilled(r.qris)) row.terlambat += 1;
    }
    return [...map.values()].sort((a, b) => a.nama.localeCompare(b.nama));
  }, [sections, q.data, jabatanMap]);

  const periodeLabel = `${from} s/d ${to}`;
  const fileBase = `laporan-absensi-${(activeUker?.nama ?? "uker").replace(/\s+/g, "-").toLowerCase()}-${from}_${to}`;
  const headers = ["Nama Pekerja", "Jabatan", "Izin", "Sakit", "Terlambat", "Tanpa Ket."];
  const bodyRows = () => rows.map((r) => [r.nama, r.jabatan, r.izin, r.sakit, r.terlambat, r.tanpa]);

  function saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadCsv() {
    const csv = [headers, ...bodyRows()]
      .map((line) => line.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    saveBlob(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }), `${fileBase}.csv`);
  }

  /** Ekspor Excel (.xlsx) dengan judul, periode, dan tabel rekap. */
  async function downloadExcel() {
    const XLSX = await import("xlsx");
    const aoa = [
      ["LAPORAN ABSENSI DOA & BRIEFING PAGI"],
      [`Unit Kerja: ${activeUker?.nama ?? "-"}`],
      [`Periode: ${periodeLabel}`],
      [],
      headers,
      ...bodyRows(),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 30 }, { wch: 28 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap Absensi");
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
    saveBlob(
      new Blob([out], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      `${fileBase}.xlsx`,
    );
  }

  /** Ekspor PDF bergaya BRI: header gradasi, kartu ringkasan, tabel bergaris. */
  async function downloadPdf() {
    const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const doc = new JsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const navy: [number, number, number] = [0, 60, 120];
    const orange: [number, number, number] = [243, 112, 33];

    // Header: pita gradasi biru BRI dengan aksen oranye.
    for (let i = 0; i < 90; i += 1) {
      const t = i / 90;
      doc.setFillColor(
        Math.round(navy[0] + (0 - navy[0]) * t * 0.2 + 10 * t),
        Math.round(navy[1] + 40 * t),
        Math.round(navy[2] + 50 * t),
      );
      doc.rect(0, i, W, 1, "F");
    }
    doc.setFillColor(...orange);
    doc.rect(0, 90, W, 5, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(19);
    doc.text("LAPORAN ABSENSI DOA & BRIEFING PAGI", 40, 44);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`${activeUker?.nama ?? "-"}  •  Periode ${periodeLabel}`, 40, 68);

    // Kartu ringkasan total per kategori.
    const totals = rows.reduce(
      (a, r) => ({
        izin: a.izin + r.izin,
        sakit: a.sakit + r.sakit,
        terlambat: a.terlambat + r.terlambat,
        tanpa: a.tanpa + r.tanpa,
      }),
      { izin: 0, sakit: 0, terlambat: 0, tanpa: 0 },
    );
    const cards: [string, number][] = [
      ["Total Izin", totals.izin],
      ["Total Sakit", totals.sakit],
      ["Total Terlambat", totals.terlambat],
      ["Total Tanpa Ket.", totals.tanpa],
    ];
    const cardW = (W - 80 - 30) / 4;
    cards.forEach(([label, value], i) => {
      const x = 40 + i * (cardW + 10);
      doc.setFillColor(244, 247, 252);
      doc.roundedRect(x, 112, cardW, 52, 8, 8, "F");
      doc.setFillColor(...orange);
      doc.roundedRect(x, 112, 4, 52, 2, 2, "F");
      doc.setTextColor(110, 120, 135);
      doc.setFontSize(9);
      doc.text(label.toUpperCase(), x + 14, 132);
      doc.setTextColor(...navy);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(17);
      doc.text(String(value), x + 14, 154);
      doc.setFont("helvetica", "normal");
    });

    autoTable(doc, {
      startY: 182,
      head: [headers],
      body: bodyRows().map((r) => r.map(String)),
      theme: "grid",
      styles: { font: "helvetica", fontSize: 10, cellPadding: 7, lineColor: [226, 232, 240] },
      headStyles: { fillColor: navy, textColor: 255, fontStyle: "bold", halign: "center" },
      alternateRowStyles: { fillColor: [246, 249, 253] },
      columnStyles: {
        0: { halign: "left", cellWidth: 180 },
        1: { halign: "left", cellWidth: 180 },
        2: { halign: "center" },
        3: { halign: "center" },
        4: { halign: "center" },
        5: { halign: "center" },
      },
      margin: { left: 40, right: 40, bottom: 46 },
      didDrawPage: () => {
        const H = doc.internal.pageSize.getHeight();
        doc.setDrawColor(...orange);
        doc.setLineWidth(1);
        doc.line(40, H - 34, W - 40, H - 34);
        doc.setFontSize(8);
        doc.setTextColor(130, 138, 150);
        doc.text("BRI BO Pringsewu — SuperIT Apps", 40, H - 20);
        doc.text(
          `Dicetak ${new Date().toLocaleString("id-ID")}`,
          W - 40,
          H - 20,
          { align: "right" },
        );
      },
    });

    doc.save(`${fileBase}.pdf`);
  }

  function download() {
    if (!rows.length) return;
    if (format === "xlsx") void downloadExcel();
    else if (format === "pdf") void downloadPdf();
    else downloadCsv();
  }


  return (
    <div className="space-y-4">
      <div className="glass-card flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-52 flex-1">
          <Label
            htmlFor="rep-uker"
            className="pl-4 text-xs font-bold uppercase tracking-wide"
          >
            Unit Kerja
          </Label>
          <select
            id="rep-uker"
            value={activeUkerId}
            onChange={(e) => setUkerId(e.target.value)}
            className="mt-1 h-10 w-full rounded-full border border-input bg-background px-4 text-sm"
          >
            {ukers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nama}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-44">
          <Label
            htmlFor="rep-bulan"
            className="pl-4 text-xs font-bold uppercase tracking-wide"
          >
            Bulan
          </Label>
          <select
            id="rep-bulan"
            value={bulan}
            disabled={!!(customFrom && customTo)}
            onChange={(e) => setBulan(e.target.value)}
            className="mt-1 h-10 w-full rounded-full border border-input bg-background px-4 text-sm disabled:opacity-50"
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className="pl-4 text-xs font-bold uppercase tracking-wide">
            Periode Kustom
          </Label>
          <div className="mt-1 flex items-center gap-2">
            <Input
              type="date"
              aria-label="Tanggal mulai"
              className="h-10 rounded-full"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
            <Input
              type="date"
              aria-label="Tanggal akhir"
              className="h-10 rounded-full"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
            />
            {customFrom || customTo ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-full"
                aria-label="Reset periode kustom"
                onClick={() => {
                  setCustomFrom("");
                  setCustomTo("");
                }}
              >
                <X className="size-4" />
              </Button>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col justify-end">
          <select
            id="rep-format"
            value={format}
            onChange={(e) => setFormat(e.target.value as "csv" | "xlsx" | "pdf")}
            className="h-10 rounded-full border border-input bg-background px-4 text-sm"
          >
            <option value="pdf">PDF</option>
            <option value="xlsx">Excel (.xlsx)</option>
            <option value="csv">CSV</option>
          </select>
        </div>
        <Button type="button" className="h-10 rounded-full px-6" onClick={download} disabled={!rows.length}>
          Download Laporan
        </Button>

      </div>

      <div className="glass-card space-y-3 p-4">
        <p className="text-xs text-muted-foreground">
          Rekap {activeUker?.nama ?? "-"} — periode {from} s/d {to}
        </p>
        {q.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Memuat laporan…
          </p>
        ) : rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] border-separate border-spacing-2 text-sm">
              <thead>
                <tr>
                  <th className="min-w-[12rem] rounded-full bg-primary/15 px-4 py-2 text-left font-bold text-primary">
                    Nama Pekerja
                  </th>
                  <th className="min-w-[12rem] rounded-full bg-primary/15 px-4 py-2 text-left font-bold text-primary">
                    Jabatan
                  </th>
                  {["Izin", "Sakit", "Terlambat", "Tanpa Ket."].map((h) => (
                    <th
                      key={h}
                      className="w-28 rounded-full bg-primary/15 px-3 py-2 text-center font-bold text-primary"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.nama}>
                    <td className="rounded-full bg-muted/50 px-4 py-2 font-medium">{r.nama}</td>
                    <td className="rounded-full bg-muted/50 px-4 py-2 text-muted-foreground">{r.jabatan}</td>
                    <td className="rounded-full bg-muted/40 px-3 py-2 text-center">{r.izin}</td>
                    <td className="rounded-full bg-muted/40 px-3 py-2 text-center">{r.sakit}</td>
                    <td className="rounded-full bg-muted/40 px-3 py-2 text-center">{r.terlambat}</td>
                    <td className="rounded-full bg-muted/40 px-3 py-2 text-center">{r.tanpa}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Belum ada data absensi pada periode ini.</p>
        )}
      </div>
    </div>
  );
}


export const Route = createFileRoute("/_authenticated/admin/setting-doa-pagi")({
  head: () => ({
    meta: [
      { title: "Setting Absensi Doa Pagi — Panel BRI BO Pringsewu" },
      {
        name: "description",
        content:
          "Kelola bagian absensi doa & briefing pagi: nomor urut, nama bagian, deskripsi, keterangan, dan daftar pekerja.",
      },
      { property: "og:title", content: "Setting Absensi Doa Pagi — Panel BRI BO Pringsewu" },
      {
        property: "og:description",
        content: "Pengaturan bagian dan daftar pekerja untuk absensi doa & briefing pagi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

type Form = Omit<DoaPagiSection, "id"> & { id?: string };

const emptyForm = (ukerId: string, ukerNama: string, urutan: number): Form => ({
  ukerId,
  ukerNama,
  urutan,
  nama: "",
  deskripsi: "",
  keterangan: "",
  pekerja: [],
});

function Page() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["doa-pagi", "settings"], queryFn: () => getDoaPagiSettings() });
  const ukers = q.data?.ukers ?? [];
  const employees = q.data?.employees ?? [];
  const [ukerId, setUkerId] = useState<string>("");
  const activeUkerId = ukerId || ukers[0]?.id || "";
  const activeUker = ukers.find((u) => u.id === activeUkerId);

  const sections = useMemo(
    () =>
      (q.data?.sections ?? [])
        .filter((s) => s.ukerId === activeUkerId)
        .slice()
        .sort((a, b) => a.urutan - b.urutan),
    [q.data, activeUkerId],
  );

  const [tab, setTab] = useState<"setting" | "laporan">("setting");
  const [form, setForm] = useState<Form | null>(null);
  const [jabatanFilter, setJabatanFilter] = useState("");

  /** Pekerja hanya dari unit kerja yang sedang dipilih admin. */
  const ukerEmployees = useMemo(
    () => employees.filter((e) => e.ukerId === activeUkerId),
    [employees, activeUkerId],
  );

  const jabatanOptions = useMemo(
    () =>
      Array.from(new Set(ukerEmployees.map((e) => e.jabatan))).sort((a, b) => a.localeCompare(b)),
    [ukerEmployees],
  );

  const visibleEmployees = useMemo(
    () => ukerEmployees.filter((e) => !jabatanFilter || e.jabatan === jabatanFilter),
    [ukerEmployees, jabatanFilter],
  );



  const save = useMutation({
    mutationFn: (f: Form) => saveDoaPagiSection({ data: f }),
    onSuccess: async () => {
      toast.success("Bagian tersimpan.");
      setForm(null);
      await qc.invalidateQueries({ queryKey: ["doa-pagi"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteDoaPagiSection({ data: { id } }),
    onSuccess: async () => {
      toast.success("Bagian dihapus.");
      await qc.invalidateQueries({ queryKey: ["doa-pagi"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function startNew() {
    if (!activeUker) return;
    setForm(emptyForm(activeUker.id, activeUker.nama, sections.length + 1));
  }

  function submit() {
    if (!form) return;
    if (!form.nama.trim()) {
      toast.error("Nama bagian wajib diisi.");
      return;
    }
    save.mutate({ ...form, nama: form.nama.trim() });
  }

  return (
    <AdminPage menuKey="setting-doa-pagi">
      <div className="space-y-5">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Sunrise className="size-6" /> Absensi Doa Pagi
          </h1>
          <p className="text-sm text-muted-foreground">
            Kelola bagian per unit kerja: nomor urut, nama bagian, deskripsi, keterangan, dan daftar
            pekerja yang tampil pada layar absensi.
          </p>
        </div>

        <div className="inline-flex rounded-full border border-input bg-muted/40 p-1">
          {(["setting", "laporan"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-full px-5 py-2 text-sm font-medium transition ${
                tab === t
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "setting" ? "Pengaturan" : "Laporan Absensi"}
            </button>
          ))}
        </div>

        {tab === "laporan" ? (
          <ReportPanel ukers={ukers} />
        ) : (
        <>
        <LogoSettings />

        {q.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Memuat pengaturan…
          </p>
        ) : (
          <>
            <div className="glass-card flex flex-wrap items-end gap-3 p-4">
              <div className="min-w-56 flex-1">
                <Label htmlFor="uker">Unit Kerja</Label>
                <select
                  id="uker"
                  value={activeUkerId}
                  onChange={(e) => {
                    setUkerId(e.target.value);
                    setForm(null);
                    setJabatanFilter("");
                  }}

                  className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {ukers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nama}
                    </option>
                  ))}
                </select>
              </div>
              <Button onClick={startNew} disabled={!activeUker}>
                <Plus className="size-4" /> Bagian Baru
              </Button>
            </div>

            {form ? (
              <div className="glass-card space-y-4 p-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">{form.id ? "Ubah Bagian" : "Bagian Baru"}</h2>
                  <Button variant="ghost" size="icon" onClick={() => setForm(null)} aria-label="Tutup">
                    <X className="size-4" />
                  </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-[120px_minmax(0,1fr)]">
                  <div>
                    <Label htmlFor="urutan">Nomor Urut</Label>
                    <Input
                      id="urutan"
                      type="number"
                      min={1}
                      value={form.urutan}
                      onChange={(e) => setForm({ ...form, urutan: Number(e.target.value) || 1 })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="nama">Nama Bagian</Label>
                    <Input
                      id="nama"
                      value={form.nama}
                      maxLength={80}
                      placeholder="contoh: ADK"
                      onChange={(e) => setForm({ ...form, nama: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="deskripsi">Deskripsi</Label>
                    <Textarea
                      id="deskripsi"
                      value={form.deskripsi}
                      maxLength={500}
                      onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="keterangan">Keterangan</Label>
                    <Textarea
                      id="keterangan"
                      value={form.keterangan}
                      maxLength={500}
                      onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <div>
                      <Label htmlFor="filter-jabatan">Pilih Pekerja (Filter Jabatan)</Label>
                      <select
                        id="filter-jabatan"
                        value={jabatanFilter}
                        onChange={(e) => setJabatanFilter(e.target.value)}
                        className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="">Semua jabatan</option>
                        {jabatanOptions.map((j) => (
                          <option key={j} value={j}>
                            {j}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border border-input p-2">
                      {visibleEmployees.length ? (
                        visibleEmployees.map((emp) => {
                          const checked = form.pekerja.includes(emp.nama);
                          return (
                            <label
                              key={`${emp.nama}-${emp.jabatan}`}
                              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50"
                            >
                              <input
                                type="checkbox"
                                className="size-4 accent-primary"
                                checked={checked}
                                onChange={(e) =>
                                  setForm({
                                    ...form,
                                    pekerja: e.target.checked
                                      ? [...form.pekerja, emp.nama]
                                      : form.pekerja.filter((x) => x !== emp.nama),
                                  })
                                }
                              />
                              <span className="flex-1">{emp.nama}</span>
                              <span className="text-xs text-muted-foreground">{emp.jabatan}</span>
                            </label>
                          );
                        })
                      ) : (
                        <p className="px-2 py-1.5 text-sm text-muted-foreground">
                          Belum ada data pekerja pada unit kerja ini.
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Hanya pegawai unit kerja <strong>{activeUker?.nama ?? "-"}</strong>.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Pekerja Terdaftar di Bagian Ini ({form.pekerja.length})</Label>
                    <div className="max-h-[21.5rem] space-y-1 overflow-y-auto rounded-md border border-input p-2">
                      {form.pekerja.length ? (
                        form.pekerja.map((p, i) => (
                          <div
                            key={p}
                            className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50"
                          >
                            <Badge variant="secondary" className="min-w-7 justify-center">
                              {i + 1}
                            </Badge>
                            <span className="flex-1">{p}</span>
                            <button
                              type="button"
                              aria-label={`Hapus ${p}`}
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() =>
                                setForm({ ...form, pekerja: form.pekerja.filter((x) => x !== p) })
                              }
                            >
                              <X className="size-4" />
                            </button>
                          </div>
                        ))
                      ) : (
                        <p className="px-2 py-1.5 text-sm text-muted-foreground">
                          Belum ada pekerja dipilih. Ceklis pekerja di sebelah kiri.
                        </p>
                      )}
                    </div>
                  </div>
                </div>



                <Button onClick={submit} disabled={save.isPending}>
                  {save.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  Simpan
                </Button>
              </div>
            ) : null}

            <div className="space-y-3">
              {sections.length ? (
                sections.map((s) => (
                  <div key={s.id} className="glass-card flex flex-wrap items-start gap-4 p-4">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-muted font-bold">
                      {s.urutan}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <h3 className="font-semibold">{s.nama}</h3>
                      {s.deskripsi ? (
                        <p className="text-sm text-muted-foreground">{s.deskripsi}</p>
                      ) : null}
                      {s.keterangan ? (
                        <p className="text-xs text-muted-foreground">{s.keterangan}</p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        {s.pekerja.length} pekerja
                        {s.pekerja.length ? `: ${s.pekerja.join(", ")}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="secondary" onClick={() => setForm({ ...s })}>
                        Ubah
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Hapus bagian ${s.nama}`}
                        onClick={() => remove.mutate(s.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Belum ada bagian untuk unit kerja ini.
                </p>
              )}
            </div>
          </>
        )}
        </>
        )}
      </div>
    </AdminPage>
  );
}
