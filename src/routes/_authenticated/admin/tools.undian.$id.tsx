import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  FileDown,
  Gift,
  Plus,
  RotateCcw,
  Settings,
  Sparkles,
  Trash2,
  Trophy,
  Upload,
  Users,
} from "lucide-react";
import { AdminPage } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePickerField } from "@/components/DatePickerField";
import { useConfirm } from "@/components/ConfirmDialog";
import { UndianPesertaPicker, type PickedEmployee } from "@/components/UndianPesertaPicker";
import {
  formatTanggalIndo,
  formatWaktu,
  sisaKuotaHadiah,
  type UndianHadiah,
  type UndianKategori,
  type UndianPemenang,
  type UndianPeserta,
  type UndianSettings,
} from "@/lib/undian-ui";
import {
  addUndianHadiah,
  addUndianKategori,
  addUndianPeserta,
  deleteAllUndianPeserta,
  deleteUndianHadiah,
  deleteUndianKategori,
  deleteUndianPemenang,
  deleteUndianPeserta,
  getUndianEvent,
  importUndianPeserta,
  resetUndianPemenang,
  saveUndianEvent,
  undiUndianPemenang,
  type UndianPesertaInput,
} from "@/lib/undian.functions";

export const Route = createFileRoute("/_authenticated/admin/tools/undian/$id")({
  head: () => ({
    meta: [
      { title: "Panggung Undian — SuperIT Apps" },
      {
        name: "description",
        content:
          "Jalankan undian doorprize acara: kocok pemenang per kategori dan hadiah, kelola peserta, dan unduh laporan pemenang.",
      },
      { property: "og:title", content: "Panggung Undian — SuperIT Apps" },
      { property: "og:description", content: "Panggung undian doorprize BRI BO Pringsewu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

type Tab = "undian" | "laporan" | "peserta" | "pengaturan";

function Page() {
  const { id } = Route.useParams();
  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>("undian");

  const q = useQuery({
    queryKey: ["undian-event", id],
    queryFn: () => getUndianEvent({ data: { id } }),
  });
  const refresh = () => q.refetch();

  const event = q.data?.event as UndianSettings | undefined;
  const kategori = useMemo(() => (q.data?.kategori ?? []) as UndianKategori[], [q.data]);
  const hadiah = useMemo(() => (q.data?.hadiah ?? []) as UndianHadiah[], [q.data]);
  const peserta = useMemo(() => (q.data?.peserta ?? []) as UndianPeserta[], [q.data]);
  const pemenang = useMemo(() => (q.data?.pemenang ?? []) as UndianPemenang[], [q.data]);

  /* ------------------------------- panggung ------------------------------- */
  const [kategoriId, setKategoriId] = useState("");
  const [hadiahId, setHadiahId] = useState("");
  const [jumlah, setJumlah] = useState(1);
  const [rolling, setRolling] = useState(false);
  const [rollName, setRollName] = useState("");
  const [hasil, setHasil] = useState<UndianPemenang[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  useEffect(() => {
    setHadiahId("");
    setJumlah(1);
  }, [kategoriId]);

  const belumMenang = peserta.filter(
    (p) => p.aktif && !pemenang.some((w) => w.pesertaId === p.id || w.nip === p.nip),
  ).length;

  const hadiahTersedia = hadiah.filter((h) => h.kategoriId === kategoriId);
  const hadiahDipilih = hadiah.find((h) => h.id === hadiahId);
  const sisaKuota = hadiahDipilih ? sisaKuotaHadiah(hadiahDipilih, pemenang) : null;
  const maxJumlah = Math.max(1, Math.min(10, sisaKuota ?? 10));
  useEffect(() => {
    if (jumlah > maxJumlah) setJumlah(maxJumlah);
  }, [maxJumlah, jumlah]);

  async function jalankanUndian() {
    if (rolling) return;
    setHasil([]);
    setRolling(true);
    const pool = peserta;
    timer.current = setInterval(() => {
      const r = pool[Math.floor(Math.random() * pool.length)];
      setRollName(r?.nama ?? "• • •");
    }, 70);
    try {
      const res = await undiUndianPemenang({
        data: { eventId: id, kategoriId: kategoriId || null, hadiahId: hadiahId || null, jumlah },
      });
      await new Promise((r) => setTimeout(r, 2200));
      if (!res.success) {
        if (timer.current) clearInterval(timer.current);
        setRolling(false);
        setRollName("");
        toast.error(res.message);
        return;
      }
      const winners = res.winners as UndianPemenang[];
      for (let i = 0; i < winners.length; i++) {
        setHasil((prev) => [...prev, winners[i]!]);
        if (i < winners.length - 1) await new Promise((r) => setTimeout(r, 2000));
      }
      if (timer.current) clearInterval(timer.current);
      setRolling(false);
      setRollName("");
      await refresh();
      toast.success("Selamat kepada pemenang!");
    } catch (e) {
      if (timer.current) clearInterval(timer.current);
      setRolling(false);
      setRollName("");
      toast.error(e instanceof Error ? e.message : "Gagal mengundi");
    }
  }

  const n = Math.max(hasil.length, rolling ? jumlah : 0);
  const cols = n > 5 ? 2 : 1;
  const sizes =
    n > 5
      ? { card: "py-3", nama: "text-lg sm:text-xl", detail: "text-[0.7rem]" }
      : n > 2
        ? { card: "py-4", nama: "text-2xl sm:text-3xl", detail: "text-xs" }
        : { card: "py-8", nama: "text-3xl sm:text-5xl", detail: "text-sm" };

  /* -------------------------------- laporan -------------------------------- */
  async function exportExcel() {
    const XLSX = await import("xlsx");
    const rows = pemenang.map((p, i) => ({
      No: i + 1,
      "Personal Number": p.nip,
      "Nama Peserta": p.namaPeserta,
      "Unit Kerja": p.unitKerja,
      Kategori: p.kategoriNama,
      Hadiah: p.hadiahNama,
      "Waktu Menang": formatWaktu(p.createdAt),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Daftar Pemenang");
    XLSX.writeFile(wb, `Pemenang-${event?.namaAcara ?? "Undian"}.xlsx`);
  }

  /* -------------------------------- peserta -------------------------------- */
  const [cari, setCari] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [importKategori, setImportKategori] = useState("all");
  const [pesertaForm, setPesertaForm] = useState({
    nip: "",
    nama: "",
    unitKerja: "",
    kategoriAkses: "all",
  });

  const filtered = peserta.filter(
    (p) =>
      p.nama.toLowerCase().includes(cari.toLowerCase()) ||
      p.nip.toLowerCase().includes(cari.toLowerCase()),
  );

  const namaKategoriAkses = (val: string) =>
    val === "all" ? "Semua Kategori" : (kategori.find((k) => k.id === val)?.nama ?? "Semua Kategori");

  async function onImportFile(file: File) {
    const XLSX = await import("xlsx");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) return;
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName]!);
    const rows: UndianPesertaInput[] = raw
      .map((r) => {
        const get = (...keys: string[]) => {
          for (const k of Object.keys(r)) {
            if (keys.some((key) => k.toLowerCase().trim() === key)) return String(r[k] ?? "").trim();
          }
          return "";
        };
        return {
          nip: get("personal number", "personalnumber", "pn", "nip"),
          nama: get("nama", "nama peserta", "name"),
          unitKerja: get("unit kerja", "unit", "unitkerja", "uker") || "-",
          kategoriAkses: importKategori,
        };
      })
      .filter((r) => r.nip && r.nama);
    if (rows.length === 0) {
      toast.error("Tidak ada baris valid. Kolom wajib: Personal Number, Nama, Unit Kerja");
      return;
    }
    const res = await importUndianPeserta({ data: { eventId: id, rows } });
    await refresh();
    toast.success(`${res.count} peserta diimpor`);
  }

  async function unduhTemplate() {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([
      ["Personal Number", "Nama", "Unit Kerja"],
      ["12345678", "Budi Santoso", "Unit Bisnis Mikro"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Peserta");
    XLSX.writeFile(wb, "template-peserta-undian.xlsx");
  }

  /* ------------------------------ pengaturan ------------------------------- */
  const [namaKategori, setNamaKategori] = useState("");
  const [tanggal, setTanggal] = useState("");
  useEffect(() => {
    if (event?.tanggal) setTanggal(event.tanggal);
  }, [event?.tanggal]);
  const [hadiahForm, setHadiahForm] = useState({ nama: "", kategoriId: "", jumlah: 1 });

  const tabs: { key: Tab; label: string; icon: typeof Gift }[] = [
    { key: "undian", label: "Undian", icon: Sparkles },
    { key: "laporan", label: "Laporan", icon: Trophy },
    { key: "peserta", label: "Peserta", icon: Users },
    { key: "pengaturan", label: "Pengaturan", icon: Settings },
  ];

  return (
    <AdminPage menuKey="tools">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Button asChild variant="ghost" size="sm" className="mb-1 -ml-2">
              <Link to="/admin/tools/undian">
                <ArrowLeft className="size-4" /> Kembali
              </Link>
            </Button>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Gift className="size-6" /> {event?.namaAcara ?? "Undian"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {event?.namaKantor} · {formatTanggalIndo(event?.tanggal)}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tabs.map((t) => (
              <Button
                key={t.key}
                size="sm"
                variant={tab === t.key ? "default" : "secondary"}
                onClick={() => setTab(t.key)}
              >
                <t.icon className="size-4" /> {t.label}
              </Button>
            ))}
          </div>
        </div>

        {q.isLoading ? <p className="text-sm text-muted-foreground">Memuat...</p> : null}

        {/* ------------------------------ PANGGUNG ------------------------------ */}
        {tab === "undian" && event ? (
          <div
            className="undian-stage rounded-3xl p-6 sm:p-8"
            style={{ ["--ud-accent" as string]: event.themeColor }}
          >
            <header className="text-center text-white">
              {event.logoUrl ? (
                <img
                  src={event.logoUrl}
                  alt="Logo acara"
                  className="mx-auto mb-4 h-20 object-contain"
                />
              ) : null}
              <h2 className="text-3xl font-black uppercase tracking-wider drop-shadow-lg sm:text-4xl">
                {event.namaAcara}
              </h2>
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
                {event.namaKantor} • {formatTanggalIndo(event.tanggal)}
              </p>
            </header>

            <div className="mt-6 rounded-3xl border border-white/25 bg-white/10 p-5 backdrop-blur-xl sm:p-6">
              <div className="mb-5 flex flex-wrap justify-center gap-3 text-center text-xs font-bold uppercase tracking-wide text-white">
                <span className="rounded-full bg-white/15 px-4 py-1.5">
                  Peserta: {peserta.length}
                </span>
                <span className="rounded-full bg-white/15 px-4 py-1.5">
                  Belum menang: {belumMenang}
                </span>
                <span className="rounded-full bg-white/15 px-4 py-1.5">
                  Pemenang: {pemenang.length}
                </span>
              </div>

              <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                <div
                  className={`min-h-52 flex-1 rounded-2xl bg-black/25 p-4 text-center text-white sm:p-6 ${
                    cols === 2 ? "grid grid-cols-1 gap-3 sm:grid-cols-2" : "space-y-3"
                  }`}
                >
                  {hasil.map((w, i) => (
                    <div
                      key={w.id}
                      className={`undian-pop flex flex-col justify-center rounded-xl bg-amber-300/95 px-5 text-slate-900 ${sizes.card}`}
                    >
                      <div className="text-[0.65rem] font-bold uppercase tracking-widest opacity-70">
                        Pemenang {i + 1}
                      </div>
                      <div className={`font-black uppercase leading-tight ${sizes.nama}`}>
                        {w.namaPeserta}
                      </div>
                      <div className={`mt-1 font-semibold ${sizes.detail}`}>
                        {w.nip} — {w.unitKerja}
                      </div>
                      <div className="mt-1 text-[0.65rem] font-bold uppercase tracking-widest">
                        {w.hadiahNama}
                      </div>
                    </div>
                  ))}

                  {rolling ? (
                    <div
                      className={`undian-glow flex min-h-40 items-center justify-center rounded-xl text-3xl font-black uppercase tracking-widest sm:text-5xl ${
                        cols === 2 ? "sm:col-span-2" : ""
                      }`}
                    >
                      {rollName || "• • •"}
                    </div>
                  ) : null}

                  {!rolling && hasil.length === 0 ? (
                    <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 opacity-80">
                      <Sparkles className="size-10 text-amber-300" />
                      <p className="text-lg font-semibold">Siap mengundi pemenang</p>
                    </div>
                  ) : null}
                </div>

                <div className="w-full shrink-0 space-y-4 lg:w-72">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-white">Kategori</Label>
                    <select
                      value={kategoriId}
                      onChange={(e) => setKategoriId(e.target.value)}
                      className="h-10 w-full rounded-md border border-white/30 bg-white/90 px-3 text-sm text-slate-900"
                    >
                      <option value="">Pilih kategori</option>
                      {kategori.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.nama}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-white">Hadiah</Label>
                    <select
                      value={hadiahId}
                      disabled={!kategoriId}
                      onChange={(e) => setHadiahId(e.target.value)}
                      className="h-10 w-full rounded-md border border-white/30 bg-white/90 px-3 text-sm text-slate-900 disabled:opacity-60"
                    >
                      <option value="">{kategoriId ? "Pilih hadiah" : "Pilih kategori dulu"}</option>
                      {hadiahTersedia.map((h) => {
                        const sisa = sisaKuotaHadiah(h, pemenang);
                        return (
                          <option key={h.id} value={h.id} disabled={sisa === 0}>
                            {h.nama} (sisa {sisa}/{h.jumlah})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold uppercase text-white">
                      Jumlah {sisaKuota !== null ? `(maks ${maxJumlah})` : ""}
                    </Label>
                    <select
                      value={jumlah}
                      disabled={!hadiahId}
                      onChange={(e) => setJumlah(Number(e.target.value) || 1)}
                      className="h-10 w-full rounded-md border border-white/30 bg-white/90 px-3 text-sm text-slate-900 disabled:opacity-60"
                    >
                      {Array.from({ length: maxJumlah }, (_, i) => i + 1).map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>

                  <Button
                    onClick={() => void jalankanUndian()}
                    disabled={rolling || !hadiahId}
                    size="lg"
                    className="h-11 w-full bg-amber-400 font-black uppercase tracking-wide text-slate-900 hover:bg-amber-300"
                  >
                    {rolling ? "Mengundi..." : "Mulai Undian"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* ------------------------------- LAPORAN ------------------------------ */}
        {tab === "laporan" ? (
          <div className="glass-card space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold uppercase tracking-wide">Laporan Pemenang</h2>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => void exportExcel()}>
                  <FileDown className="size-4" /> Export Excel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Reset seluruh pemenang?",
                      description: "Semua data pemenang pada event ini akan dihapus.",
                      destructive: true,
                    });
                    if (!ok) return;
                    await resetUndianPemenang({ data: { eventId: id } });
                    setHasil([]);
                    await refresh();
                    toast.success("Data pemenang direset");
                  }}
                >
                  <RotateCcw className="size-4" /> Reset Pemenang
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/60">
                  <tr>
                    {["No", "Personal Number", "Nama", "Unit Kerja", "Kategori", "Hadiah", "Waktu"].map(
                      (h) => (
                        <th key={h} className="whitespace-nowrap px-3 py-2 text-left font-semibold">
                          {h}
                        </th>
                      ),
                    )}
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {pemenang.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                        Belum ada pemenang.
                      </td>
                    </tr>
                  ) : null}
                  {pemenang.map((p, i) => (
                    <tr key={p.id} className="border-t border-border/60">
                      <td className="px-3 py-2">{i + 1}</td>
                      <td className="px-3 py-2 font-mono">{p.nip}</td>
                      <td className="px-3 py-2 font-semibold">{p.namaPeserta}</td>
                      <td className="px-3 py-2">{p.unitKerja}</td>
                      <td className="px-3 py-2">{p.kategoriNama}</td>
                      <td className="px-3 py-2">{p.hadiahNama}</td>
                      <td className="whitespace-nowrap px-3 py-2">{formatWaktu(p.createdAt)}</td>
                      <td className="px-3 py-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={async () => {
                            await deleteUndianPemenang({ data: { eventId: id, id: p.id } });
                            await refresh();
                          }}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {/* ------------------------------- PESERTA ------------------------------ */}
        {tab === "peserta" ? (
          <div className="glass-card space-y-4 p-5">
            <h2 className="text-lg font-bold uppercase tracking-wide">
              Peserta ({peserta.length})
            </h2>

            <div className="grid gap-3 rounded-xl border border-border/60 p-3">
              <div className="grid gap-2">
                <Label className="text-xs font-bold uppercase">
                  1. Kategori peserta untuk penambahan ini
                </Label>
                <select
                  value={importKategori}
                  onChange={(e) => setImportKategori(e.target.value)}
                  className="h-10 w-full max-w-sm rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">Semua Kategori</option>
                  {kategori.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nama}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="default" onClick={() => setPickerOpen(true)}>
                  <Users className="size-4" /> Impor dari Data Pekerja
                </Button>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-secondary px-3 py-2 text-sm font-semibold">
                  <Upload className="size-4" /> Upload Excel Peserta
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void onImportFile(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                <Button variant="outline" onClick={() => void unduhTemplate()}>
                  Unduh Template
                </Button>
                <Button
                  variant="destructive"
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Hapus SEMUA peserta?",
                      description: "Seluruh peserta undian pada event ini akan dihapus.",
                      destructive: true,
                    });
                    if (!ok) return;
                    await deleteAllUndianPeserta({ data: { eventId: id } });
                    await refresh();
                  }}
                >
                  <Trash2 className="size-4" /> Hapus Semua
                </Button>
              </div>
            </div>

            <form
              className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!pesertaForm.nip || !pesertaForm.nama) return;
                await addUndianPeserta({
                  data: {
                    eventId: id,
                    nip: pesertaForm.nip,
                    nama: pesertaForm.nama,
                    unitKerja: pesertaForm.unitKerja || "-",
                    kategoriAkses: pesertaForm.kategoriAkses,
                  },
                });
                setPesertaForm({ nip: "", nama: "", unitKerja: "", kategoriAkses: "all" });
                await refresh();
              }}
            >
              <Input
                placeholder="Personal Number"
                value={pesertaForm.nip}
                onChange={(e) => setPesertaForm({ ...pesertaForm, nip: e.target.value })}
              />
              <Input
                placeholder="Nama"
                value={pesertaForm.nama}
                onChange={(e) => setPesertaForm({ ...pesertaForm, nama: e.target.value })}
              />
              <Input
                placeholder="Unit Kerja"
                value={pesertaForm.unitKerja}
                onChange={(e) => setPesertaForm({ ...pesertaForm, unitKerja: e.target.value })}
              />
              <select
                value={pesertaForm.kategoriAkses}
                onChange={(e) =>
                  setPesertaForm({ ...pesertaForm, kategoriAkses: e.target.value })
                }
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">Semua Kategori</option>
                {kategori.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.nama}
                  </option>
                ))}
              </select>
              <Button type="submit">
                <Plus className="size-4" /> Tambah
              </Button>
            </form>

            <Input
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari nama / personal number"
              className="max-w-xs"
            />

            <div className="max-h-96 overflow-auto rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80">
                  <tr>
                    <th className="px-3 py-2 text-left">Personal Number</th>
                    <th className="px-3 py-2 text-left">Nama</th>
                    <th className="px-3 py-2 text-left">Unit Kerja</th>
                    <th className="px-3 py-2 text-left">Kategori</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 500).map((p) => (
                    <tr key={p.id} className="border-t border-border/60">
                      <td className="px-3 py-1.5 font-mono">{p.nip}</td>
                      <td className="px-3 py-1.5">{p.nama}</td>
                      <td className="px-3 py-1.5">{p.unitKerja}</td>
                      <td className="px-3 py-1.5">{namaKategoriAkses(p.kategoriAkses)}</td>
                      <td className="px-3 py-1.5">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={async () => {
                            await deleteUndianPeserta({ data: { eventId: id, id: p.id } });
                            await refresh();
                          }}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {/* ------------------------------ PENGATURAN ---------------------------- */}
        {tab === "pengaturan" && event ? (
          <div className="space-y-4">
            <div className="glass-card space-y-3 p-5">
              <h2 className="text-lg font-bold uppercase tracking-wide">Identitas Acara</h2>
              <form
                className="grid gap-3 sm:grid-cols-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  await saveUndianEvent({
                    data: {
                      id,
                      namaAcara: String(fd.get("namaAcara") ?? ""),
                      namaKantor: String(fd.get("namaKantor") ?? ""),
                      tanggal: tanggal,
                      themeColor: String(fd.get("themeColor") ?? "#1d6eb7"),
                      logoUrl: String(fd.get("logoUrl") ?? "") || null,
                      bgUrl: String(fd.get("bgUrl") ?? "") || null,
                    },
                  });
                  await refresh();
                  toast.success("Pengaturan disimpan");
                }}
              >
                <div className="space-y-1.5">
                  <Label>Nama Acara</Label>
                  <Input name="namaAcara" defaultValue={event.namaAcara} />
                </div>
                <div className="space-y-1.5">
                  <Label>Nama Kantor</Label>
                  <Input name="namaKantor" defaultValue={event.namaKantor} />
                </div>
                <div className="space-y-1.5">
                  <Label>Tanggal</Label>
                  <DatePickerField value={tanggal} onChange={setTanggal} />
                </div>
                <div className="space-y-1.5">
                  <Label>Warna Tema</Label>
                  <Input
                    name="themeColor"
                    type="color"
                    className="h-10 p-1"
                    defaultValue={event.themeColor}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>URL Logo</Label>
                  <Input name="logoUrl" defaultValue={event.logoUrl ?? ""} />
                </div>
                <div className="space-y-1.5">
                  <Label>URL Background</Label>
                  <Input name="bgUrl" defaultValue={event.bgUrl ?? ""} />
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit">Simpan Pengaturan</Button>
                </div>
              </form>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="glass-card space-y-3 p-5">
                <h2 className="text-lg font-bold uppercase tracking-wide">Kategori Undian</h2>
                <form
                  className="flex gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!namaKategori.trim()) return;
                    await addUndianKategori({
                      data: { eventId: id, nama: namaKategori.trim() },
                    });
                    setNamaKategori("");
                    await refresh();
                  }}
                >
                  <Input
                    value={namaKategori}
                    onChange={(e) => setNamaKategori(e.target.value)}
                    placeholder="Nama kategori"
                  />
                  <Button type="submit">
                    <Plus className="size-4" />
                  </Button>
                </form>
                <ul className="space-y-2">
                  {kategori.map((k) => (
                    <li
                      key={k.id}
                      className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2"
                    >
                      <span className="font-semibold">{k.nama}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={async () => {
                          await deleteUndianKategori({ data: { eventId: id, id: k.id } });
                          await refresh();
                        }}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </li>
                  ))}
                  {kategori.length === 0 ? (
                    <li className="text-sm text-muted-foreground">Belum ada kategori.</li>
                  ) : null}
                </ul>
              </div>

              <div className="glass-card space-y-3 p-5">
                <h2 className="text-lg font-bold uppercase tracking-wide">Daftar Hadiah</h2>
                <form
                  className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!hadiahForm.nama.trim()) return;
                    if (!hadiahForm.kategoriId) {
                      toast.error("Pilih kategori hadiah terlebih dahulu.");
                      return;
                    }
                    await addUndianHadiah({
                      data: {
                        eventId: id,
                        nama: hadiahForm.nama.trim(),
                        kategoriId: hadiahForm.kategoriId,
                        jumlah: hadiahForm.jumlah,
                      },
                    });
                    setHadiahForm({ nama: "", kategoriId: "", jumlah: 1 });
                    await refresh();
                  }}
                >
                  <Input
                    value={hadiahForm.nama}
                    onChange={(e) => setHadiahForm({ ...hadiahForm, nama: e.target.value })}
                    placeholder="Nama hadiah"
                  />
                  <select
                    value={hadiahForm.kategoriId}
                    onChange={(e) => setHadiahForm({ ...hadiahForm, kategoriId: e.target.value })}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Pilih kategori…</option>
                    {kategori.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.nama}
                      </option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    min={1}
                    value={hadiahForm.jumlah}
                    onChange={(e) =>
                      setHadiahForm({ ...hadiahForm, jumlah: Number(e.target.value) || 1 })
                    }
                    className="w-20"
                  />
                  <Button type="submit" disabled={kategori.length === 0}>
                    <Plus className="size-4" />
                  </Button>
                </form>
                {kategori.length === 0 ? (
                  <p className="text-sm text-destructive">
                    Buat kategori dulu sebelum menambah hadiah.
                  </p>
                ) : null}
                <ul className="space-y-2">
                  {hadiah.map((h) => (
                    <li
                      key={h.id}
                      className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2"
                    >
                      <span className="font-semibold">
                        {h.nama} <span className="text-muted-foreground">×{h.jumlah}</span>
                        <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                          {kategori.find((k) => k.id === h.kategoriId)?.nama ?? "Tanpa kategori"}
                        </span>
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={async () => {
                          await deleteUndianHadiah({ data: { eventId: id, id: h.id } });
                          await refresh();
                        }}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </li>
                  ))}
                  {hadiah.length === 0 ? (
                    <li className="text-sm text-muted-foreground">Belum ada hadiah.</li>
                  ) : null}
                </ul>
              </div>
            </div>
          </div>
        ) : null}

        <UndianPesertaPicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          existingNips={peserta.map((p) => p.nip)}
          onImport={async (rows: PickedEmployee[]) => {
            const res = await importUndianPeserta({
              data: {
                eventId: id,
                rows: rows.map((r) => ({
                  nip: r.nip,
                  nama: r.nama,
                  unitKerja: r.unitKerja,
                  kategoriAkses: importKategori,
                })),
              },
            });
            await refresh();
            toast.success(
              res.count ? `${res.count} pekerja ditambahkan` : "Tidak ada pekerja baru",
            );
          }}
        />
      </div>
    </AdminPage>
  );
}
