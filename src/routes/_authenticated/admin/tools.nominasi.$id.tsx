import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ImagePlus, MonitorPlay, Plus, Save, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { AdminPage } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePickerField } from "@/components/DatePickerField";
import { useConfirm } from "@/components/ConfirmDialog";
import { PhotoCropDialog } from "@/components/PhotoCropDialog";
import {
  emptyNominee,
  fileToCompressedDataUrl,
  fileToTransparentDataUrl,
  normalizeBoard,
  uid,
  type NominasiBoard,
  type NominasiNominee,
} from "@/lib/nominasi-ui";
import { getNominasiEvent, saveNominasiEvent } from "@/lib/nominasi.functions";
import { listVoteEmployees } from "@/lib/vote.functions";

export const Route = createFileRoute("/_authenticated/admin/tools/nominasi/$id")({
  head: () => ({
    meta: [
      { title: "Kelola Nominasi — SuperIT Apps" },
      {
        name: "description",
        content: "Atur kategori, nominasi, logo, dan tampilan papan Best Performance.",
      },
      { property: "og:title", content: "Kelola Nominasi — SuperIT Apps" },
      {
        property: "og:description",
        content: "Pengaturan papan nominasi Best Performance BRI BO Pringsewu.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

type Employee = {
  id: string;
  nama: string;
  personalNumber: string | null;
  jabatan: string | null;
  uker: string | null;
  foto: string | null;
};

function Page() {
  const { id } = useParams({ from: "/_authenticated/admin/tools/nominasi/$id" });
  const confirm = useConfirm();
  const q = useQuery({
    queryKey: ["nominasi-event", id],
    queryFn: () => getNominasiEvent({ data: { id } }),
  });
  const emp = useQuery({ queryKey: ["vote-employees"], queryFn: () => listVoteEmployees() });

  const [namaAcara, setNamaAcara] = useState("");
  const [tanggal, setTanggal] = useState("");
  const [board, setBoard] = useState<NominasiBoard | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!q.data) return;
    setNamaAcara(q.data.namaAcara);
    setTanggal(q.data.tanggal);
    setBoard(normalizeBoard(q.data.data));
  }, [q.data]);

  // Pemilih nominasi dari Data Pekerja.
  const [picker, setPicker] = useState<{ catId: string } | null>(null);
  const [search, setSearch] = useState("");

  // Crop foto nominasi.
  const [crop, setCrop] = useState<{ src: string; catId: string; nomId: string } | null>(null);
  const fileRef = useRef<{ catId: string; nomId: string } | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const employees = (emp.data ?? []) as Employee[];
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return employees.slice(0, 60);
    return employees
      .filter(
        (e) =>
          e.nama.toLowerCase().includes(s) || (e.personalNumber ?? "").toLowerCase().includes(s),
      )
      .slice(0, 60);
  }, [employees, search]);

  function patch(fn: (b: NominasiBoard) => NominasiBoard) {
    setBoard((b) => (b ? fn(structuredClone(b)) : b));
  }

  function patchNominee(catId: string, nomId: string, data: Partial<NominasiNominee>) {
    patch((b) => {
      const cat = b.categories.find((c) => c.id === catId);
      const nom = cat?.nominees.find((n) => n.id === nomId);
      if (nom) Object.assign(nom, data);
      return b;
    });
  }

  async function save() {
    if (!board) return;
    setSaving(true);
    try {
      await saveNominasiEvent({ data: { id, namaAcara, tanggal, data: board } });
      toast.success("Pengaturan nominasi tersimpan");
      void q.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan");
    }
    setSaving(false);
  }

  async function onPickFile(file: File) {
    const target = fileRef.current;
    if (!target) return;
    try {
      const dataUrl = await fileToCompressedDataUrl(file, 900);
      setCrop({ src: dataUrl, catId: target.catId, nomId: target.nomId });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membaca foto");
    }
  }

  async function onPickLogo(file: File, key: "logo" | "logo2") {
    try {
      const dataUrl = await fileToTransparentDataUrl(file, 600);
      patch((b) => ({ ...b, [key]: dataUrl }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membaca logo");
    }
  }

  if (q.isLoading || !board) {
    return (
      <AdminPage menuKey="tools">
        <p className="text-sm text-muted-foreground">Memuat...</p>
      </AdminPage>
    );
  }

  return (
    <AdminPage menuKey="tools">
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Button asChild variant="ghost" size="sm" className="mb-1 -ml-2">
              <Link to="/admin/tools/nominasi">
                <ArrowLeft className="size-4" /> Kembali
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">{namaAcara}</h1>
            <p className="text-sm text-muted-foreground">
              Atur judul, logo, kategori, dan nominasinya. Papan bisa dimainkan saat acara.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="secondary">
              <Link to="/admin/tools/nominasi/papan/$id" params={{ id }}>
                <MonitorPlay className="size-4" /> Buka Papan
              </Link>
            </Button>
            <Button onClick={save} disabled={saving}>
              <Save className="size-4" /> {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </div>

        {/* Pengaturan umum */}
        <div className="glass-card space-y-4 p-5">
          <h2 className="font-semibold">Pengaturan Papan</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Nama Acara</Label>
              <Input value={namaAcara} onChange={(e) => setNamaAcara(e.target.value)} />
            </div>
            <div>
              <Label>Tanggal</Label>
              <DatePickerField value={tanggal} onChange={setTanggal} />
            </div>
            <div>
              <Label>Judul Papan</Label>
              <Input
                value={board.heading}
                onChange={(e) => patch((b) => ({ ...b, heading: e.target.value }))}
              />
            </div>
            <div>
              <Label>Periode</Label>
              <Input
                value={board.period}
                onChange={(e) => patch((b) => ({ ...b, period: e.target.value }))}
              />
            </div>
            <div>
              <Label>Nama Unit Kerja</Label>
              <Input
                value={board.unit}
                onChange={(e) => patch((b) => ({ ...b, unit: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {(["logo", "logo2"] as const).map((key) => {
              const heightKey = key === "logo" ? "logoHeight" : "logo2Height";
              return (
                <div key={key} className="space-y-2 rounded-lg border border-border/60 p-3">
                  <Label>{key === "logo" ? "Logo Kiri" : "Logo Kanan"}</Label>
                  <div className="flex items-center gap-3">
                    <div className="flex h-16 w-28 items-center justify-center rounded bg-muted/40">
                      {board[key] ? (
                        <img
                          src={board[key] as string}
                          alt={key}
                          className="max-h-14 max-w-24 object-contain"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">Belum ada</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-2 text-sm underline">
                        <ImagePlus className="size-4" /> Unggah
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void onPickLogo(f, key);
                            e.target.value = "";
                          }}
                        />
                      </label>
                      {board[key] ? (
                        <button
                          type="button"
                          className="text-left text-xs text-muted-foreground underline"
                          onClick={() => patch((b) => ({ ...b, [key]: null }))}
                        >
                          Hapus logo
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Tinggi logo: {board[heightKey]}px</Label>
                    <Slider
                      min={24}
                      max={160}
                      step={2}
                      value={[board[heightKey]]}
                      onValueChange={(v) =>
                        patch((b) => ({ ...b, [heightKey]: v[0] ?? b[heightKey] }))
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Kategori & nominasi */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Kategori & Nominasi</h2>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                patch((b) => ({
                  ...b,
                  categories: [
                    ...b.categories,
                    { id: uid(), name: "KATEGORI BARU", nominees: [emptyNominee()] },
                  ],
                }))
              }
            >
              <Plus className="size-4" /> Tambah Kategori
            </Button>
          </div>

          {board.categories.map((cat) => (
            <div key={cat.id} className="glass-card space-y-4 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  className="max-w-xs font-semibold"
                  value={cat.name}
                  onChange={(e) =>
                    patch((b) => {
                      const c = b.categories.find((x) => x.id === cat.id);
                      if (c) c.name = e.target.value;
                      return b;
                    })
                  }
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    patch((b) => {
                      b.categories.find((x) => x.id === cat.id)?.nominees.push(emptyNominee());
                      return b;
                    })
                  }
                >
                  <Plus className="size-4" /> Nominasi
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setPicker({ catId: cat.id })}>
                  <Users className="size-4" /> Dari Data Pekerja
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Hapus kategori?",
                      description: `Kategori "${cat.name}" beserta nominasinya akan dihapus.`,
                      destructive: true,
                    });
                    if (!ok) return;
                    patch((b) => ({
                      ...b,
                      categories: b.categories.filter((x) => x.id !== cat.id),
                    }));
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {cat.nominees.map((nom) => (
                  <div key={nom.id} className="space-y-2 rounded-lg border border-border/60 p-3">
                    <div className="flex items-center gap-3">
                      <div className="size-16 overflow-hidden rounded-full bg-muted/40">
                        {nom.photo ? (
                          <img src={nom.photo} alt={nom.name} className="size-full object-cover" />
                        ) : null}
                      </div>
                      <div className="flex flex-col gap-1 text-xs">
                        <button
                          type="button"
                          className="text-left underline"
                          onClick={() => {
                            fileRef.current = { catId: cat.id, nomId: nom.id };
                            fileInput.current?.click();
                          }}
                        >
                          Unggah foto
                        </button>
                        {nom.photo ? (
                          <button
                            type="button"
                            className="text-left text-muted-foreground underline"
                            onClick={() => patchNominee(cat.id, nom.id, { photo: null })}
                          >
                            Hapus foto
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <Input
                      value={nom.name}
                      placeholder="Nama"
                      onChange={(e) => patchNominee(cat.id, nom.id, { name: e.target.value })}
                    />
                    <Input
                      value={nom.position}
                      placeholder="Jabatan"
                      onChange={(e) => patchNominee(cat.id, nom.id, { position: e.target.value })}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full"
                      onClick={() =>
                        patch((b) => {
                          const c = b.categories.find((x) => x.id === cat.id);
                          if (c) c.nominees = c.nominees.filter((n) => n.id !== nom.id);
                          return b;
                        })
                      }
                    >
                      <Trash2 className="size-4" /> Hapus nominasi
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onPickFile(f);
          e.target.value = "";
        }}
      />

      <PhotoCropDialog
        open={!!crop}
        src={crop?.src ?? null}
        onOpenChange={(v) => !v && setCrop(null)}
        onDone={(dataUrl) => {
          if (crop) patchNominee(crop.catId, crop.nomId, { photo: dataUrl });
          setCrop(null);
        }}
      />

      <Dialog open={!!picker} onOpenChange={(v) => !v && setPicker(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pilih Nominasi dari Data Pekerja</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Cari nama / personal number"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {emp.isLoading ? (
              <p className="text-sm text-muted-foreground">Memuat data pekerja...</p>
            ) : (
              filtered.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-muted/40"
                  onClick={() => {
                    if (!picker) return;
                    patch((b) => {
                      b.categories
                        .find((c) => c.id === picker.catId)
                        ?.nominees.push({
                          id: uid(),
                          name: e.nama,
                          position: e.jabatan ?? e.uker ?? "",
                          photo: e.foto,
                        });
                      return b;
                    });
                    toast.success(`${e.nama} ditambahkan`);
                  }}
                >
                  <div className="size-9 overflow-hidden rounded-full bg-muted/40">
                    {e.foto ? <img src={e.foto} alt={e.nama} className="size-full object-cover" /> : null}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{e.nama}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[e.personalNumber, e.jabatan, e.uker].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPicker(null)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}
