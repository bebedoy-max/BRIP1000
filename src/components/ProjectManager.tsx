import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Pencil, Plus, Search, Trash2, ListChecks } from "lucide-react";
import { toast } from "sonner";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { DatePickerField } from "@/components/DatePickerField";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  customSources,
  fetchParamTotals,
  paramDefs,
  paramLabel,
  projectCustomItems,
  projectParamKeys,
  projectParamSummary,
  type ProjectItem,
} from "@/lib/projects";
import { slideImageSrc } from "@/lib/carousel";
import { useServerFn } from "@tanstack/react-start";
import { uploadProjectImage } from "@/lib/project-photo.functions";

const db = supabase as unknown as SupabaseClient;

type Row = Record<string, unknown>;

type FormState = {
  nama_project: string;
  deskripsi: string;
  parameters: string[];
  custom: ProjectItem[];
  tanggal_mulai: string;
  deadline: string;
  foto_url: string;
};

const emptyForm: FormState = {
  nama_project: "",
  deskripsi: "",
  parameters: [],
  custom: [],
  tanggal_mulai: "",
  deadline: "",
  foto_url: "",
};

const fmt = (v: unknown) =>
  v ? new Date(String(v)).toLocaleDateString("id-ID", { dateStyle: "medium" }) : "—";

export function ProjectManager({ canWrite }: { canWrite: boolean }) {
  const qc = useQueryClient();
  const confirmDialog = useConfirm();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [customOpen, setCustomOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadFn = useServerFn(uploadProjectImage);

  const toBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
      reader.onerror = () => reject(new Error("Gagal membaca file"));
      reader.readAsDataURL(file);
    });

  const uploadImage = useMutation({
    mutationFn: async (file: File) =>
      uploadFn({
        data: { fileName: file.name, mimeType: file.type, base64: await toBase64(file) },
      }),
    onSuccess: (res) => {
      setForm((f) => ({ ...f, foto_url: res.id }));
      toast.success("Gambar project terunggah");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totals = useQuery({ queryKey: ["param-totals"], queryFn: fetchParamTotals });

  const list = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await db
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.nama_project.trim()) throw new Error("Nama Project wajib diisi");
      if (!form.parameters.length && !form.custom.length)
        throw new Error("Pilih minimal satu parameter pencapaian atau target custom");
      const body: Row = {
        nama_project: form.nama_project.trim(),
        deskripsi: form.deskripsi.trim() || null,
        parameters: form.parameters,
        parameter: form.parameters[0] ?? null,
        custom_items: form.custom,
        tanggal_mulai: form.tanggal_mulai || null,
        deadline: form.deadline || null,
        foto_url: form.foto_url.trim() || null,
      };
      if (editing) {
        const { error } = await db.from("projects").update(body).eq("id", editing["id"] as string);
        if (error) throw error;
      } else {
        const { data: auth } = await db.auth.getUser();
        const { error } = await db
          .from("projects")
          .insert({ ...body, created_by: auth.user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Project diperbarui" : "Project ditambahkan");
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      void qc.invalidateQueries({ queryKey: ["projects"] });
      void qc.invalidateQueries({ queryKey: ["projects-progress-summary"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Project dihapus");
      void qc.invalidateQueries({ queryKey: ["projects"] });
      void qc.invalidateQueries({ queryKey: ["projects-progress-summary"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (list.data ?? []).filter((r) =>
    q.trim()
      ? `${String(r["nama_project"] ?? "")} ${String(r["deskripsi"] ?? "")}`
          .toLowerCase()
          .includes(q.trim().toLowerCase())
      : true,
  );

  function startCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function startEdit(row: Row) {
    setEditing(row);
    setForm({
      nama_project: String(row["nama_project"] ?? ""),
      deskripsi: String(row["deskripsi"] ?? ""),
      parameters: projectParamKeys(row),
      custom: projectCustomItems(row),
      tanggal_mulai: row["tanggal_mulai"] ? String(row["tanggal_mulai"]).slice(0, 10) : "",
      deadline: row["deadline"] ? String(row["deadline"]).slice(0, 10) : "",
      foto_url: String(row["foto_url"] ?? ""),
    });
    setOpen(true);
  }

  const paramSummary = useMemo(() => {
    const nouns = form.parameters
      .map((k) => paramDefs.find((d) => d.key === k)?.noun)
      .filter(Boolean) as string[];
    return nouns.length ? nouns.join(", ") : "Belum ada parameter dipilih";
  }, [form.parameters]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Project IT</h1>
          <p className="text-sm text-muted-foreground">
            Buat project IT, ceklis parameter pencapaian, tentukan target custom, tanggal mulai, dan
            deadline.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari project…"
              className="w-64 pl-9"
            />
          </div>
          {canWrite ? (
            <Button onClick={startCreate}>
              <Plus className="size-4" /> Tambah
            </Button>
          ) : null}
        </div>
      </div>

      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-xs tracking-wide text-muted-foreground uppercase">
              <th className="px-4 py-3 font-medium">Nama Project</th>
              <th className="px-4 py-3 font-medium">Deskripsi</th>
              <th className="px-4 py-3 font-medium">Parameter Pencapaian</th>
              <th className="px-4 py-3 font-medium">Tgl. Mulai</th>
              <th className="px-4 py-3 font-medium">Deadline</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {list.isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Memuat data…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Belum ada project.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={String(row["id"])} className="border-b border-border/40 last:border-0 hover:bg-secondary/40">
                  <td className="px-4 py-3 font-medium">{String(row["nama_project"] ?? "—")}</td>
                  <td className="max-w-[22rem] px-4 py-3 text-muted-foreground">
                    <span className="line-clamp-2">{String(row["deskripsi"] ?? "—")}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs">{projectParamSummary(row)}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{fmt(row["tanggal_mulai"])}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{fmt(row["deadline"])}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {canWrite ? (
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => startEdit(row)} aria-label="Ubah">
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Hapus"
                          onClick={() => {
                            void confirmDialog({
                              title: "Hapus project ini?",
                              description: "Data project yang dihapus tidak dapat dikembalikan.",
                              confirmText: "Hapus",
                              destructive: true,
                            }).then((ok) => {
                              if (ok) remove.mutate(String(row["id"]));
                            });
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Ubah Project" : "Tambah Project"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="nama_project">Nama Project</Label>
              <Input
                id="nama_project"
                value={form.nama_project}
                onChange={(e) => setForm((f) => ({ ...f, nama_project: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="deskripsi">Deskripsi</Label>
              <Textarea
                id="deskripsi"
                value={form.deskripsi}
                onChange={(e) => setForm((f) => ({ ...f, deskripsi: e.target.value }))}
              />
            </div>




            <div className="grid gap-2">
              <Label>Parameter Pencapaian</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="secondary" className="justify-between font-normal">
                    <span className="truncate">{paramSummary}</span>
                    <ListChecks className="size-4 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[22rem] p-2">
                  <div className="grid gap-1">
                    {paramDefs.map((d) => {
                      const checked = form.parameters.includes(d.key);
                      return (
                        <label
                          key={d.key}
                          className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-secondary/60"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) =>
                              setForm((f) => ({
                                ...f,
                                parameters: v
                                  ? [...f.parameters, d.key]
                                  : f.parameters.filter((k) => k !== d.key),
                              }))
                            }
                          />
                          <span>{paramLabel(d, totals.data?.[d.key] ?? 0)}</span>
                        </label>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
              {form.parameters.length ? (
                <div className="flex flex-wrap gap-1">
                  {form.parameters.map((k) => (
                    <Badge key={k} variant="secondary">
                      {paramDefs.find((d) => d.key === k)?.noun ?? k}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label>Target Pencapaian Custom</Label>
              <Button variant="outline" className="justify-between font-normal" onClick={() => setCustomOpen(true)}>
                <span>
                  {form.custom.length
                    ? `${form.custom.length} data terpilih`
                    : "Pilih data tertentu sebagai target"}
                </span>
                <Plus className="size-4" />
              </Button>
              {form.custom.length ? (
                <div className="max-h-32 overflow-y-auto rounded-xl border border-border/60 p-2">
                  <div className="flex flex-wrap gap-1">
                    {form.custom.map((i) => (
                      <Badge key={i.id} variant="secondary" className="max-w-full">
                        <span className="truncate">{i.label}</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="tgl">Tgl. Mulai</Label>
                <DatePickerField
                  id="tgl"
                  value={form.tanggal_mulai}
                  onChange={(v) => setForm((f) => ({ ...f, tanggal_mulai: v }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dl">Deadline</Label>
                <DatePickerField
                  id="dl"
                  value={form.deadline}
                  onChange={(v) => setForm((f) => ({ ...f, deadline: v }))}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Gambar Project</Label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) uploadImage.mutate(file);
                }}
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadImage.isPending}
                >
                  <ImagePlus className="size-4" />
                  {uploadImage.isPending
                    ? "Mengunggah…"
                    : form.foto_url
                      ? "Ganti Gambar"
                      : "Unggah Gambar"}
                </Button>
                {form.foto_url ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setForm((f) => ({ ...f, foto_url: "" }))}
                  >
                    Hapus
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                Dipakai sebagai gambar slide project pada carousel dashboard.
              </p>
              {form.foto_url.trim() ? (
                <img
                  src={slideImageSrc(form.foto_url.trim(), 600)}
                  alt="Pratinjau gambar project"
                  className="h-32 w-full rounded-xl border border-border/60 object-cover"
                />
              ) : null}
            </div>
          </div>


          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CustomTargetDialog
        open={customOpen}
        onOpenChange={setCustomOpen}
        value={form.custom}
        onSave={(items) => setForm((f) => ({ ...f, custom: items }))}
      />
    </div>
  );
}

function CustomTargetDialog({
  open,
  onOpenChange,
  value,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  value: ProjectItem[];
  onSave: (items: ProjectItem[]) => void;
}) {
  const [source, setSource] = useState(customSources[0]!.key);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<ProjectItem[]>(value);

  useEffect(() => {
    if (open) setPicked(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const items = useQuery({
    queryKey: ["custom-source", source],
    enabled: open,
    queryFn: async () => customSources.find((s) => s.key === source)!.fetch(),
  });

  const list = (items.data ?? []).filter((i) =>
    q.trim() ? i.label.toLowerCase().includes(q.trim().toLowerCase()) : true,
  );
  const pickedIds = new Set(picked.map((i) => i.id));

  function toggle(item: ProjectItem, next: boolean) {
    setPicked((p) => (next ? [...p, item] : p.filter((i) => i.id !== item.id)));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Target Pencapaian Custom</DialogTitle>
          <DialogDescription>
            Pilih sumber data, lalu ceklis hanya data yang menjadi target pencapaian project ini.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label htmlFor="src">Filter Data</Label>
            <select
              id="src"
              className="h-10 rounded-xl border border-input bg-popover px-3 text-sm"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              {customSources.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari data…"
              className="pl-9"
            />
          </div>

          <div className="max-h-72 overflow-y-auto rounded-xl border border-border/60">
            {items.isLoading ? (
              <p className="p-4 text-sm text-muted-foreground">Memuat data…</p>
            ) : list.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Tidak ada data.</p>
            ) : (
              list.map((i) => (
                <label
                  key={i.id}
                  className="flex cursor-pointer items-center gap-3 border-b border-border/40 px-3 py-2 text-sm last:border-0 hover:bg-secondary/50"
                >
                  <Checkbox
                    checked={pickedIds.has(i.id)}
                    onCheckedChange={(v) => toggle(i, Boolean(v))}
                  />
                  <span className="truncate">{i.label}</span>
                </label>
              ))
            )}
          </div>

          <p className="text-xs text-muted-foreground">{picked.length} data terpilih (semua sumber)</p>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            onClick={() => {
              onSave(picked);
              onOpenChange(false);
            }}
          >
            Simpan Target
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
