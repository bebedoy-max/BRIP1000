import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePickerField } from "@/components/DatePickerField";
import { PhotoGallery } from "@/components/PhotoGallery";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const db = supabase as unknown as SupabaseClient;

type Row = Record<string, unknown>;

type FormState = { judul: string; deskripsi: string; tanggal: string };

const emptyForm: FormState = { judul: "", deskripsi: "", tanggal: "" };

const fmt = (v: unknown) =>
  v ? new Date(String(v)).toLocaleDateString("id-ID", { dateStyle: "medium" }) : "—";

/** Menu Event: data event + galeri foto bulk yang tersimpan di Google Drive. */
export function EventGalleryManager({ canWrite }: { canWrite: boolean }) {
  const qc = useQueryClient();
  const confirmDialog = useConfirm();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [photoRow, setPhotoRow] = useState<Row | null>(null);

  const list = useQuery({
    queryKey: ["event-photos"],
    queryFn: async () => {
      const { data, error } = await db
        .from("photos")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.judul.trim()) throw new Error("Nama Event wajib diisi");
      const body: Row = {
        judul: form.judul.trim(),
        deskripsi: form.deskripsi.trim() || null,
        tanggal: form.tanggal || null,
      };
      if (editing) {
        const { error } = await db.from("photos").update(body).eq("id", editing["id"] as string);
        if (error) throw error;
        return editing;
      }
      const { data: auth } = await db.auth.getUser();
      const { data, error } = await db
        .from("photos")
        .insert({ ...body, uploaded_by: auth.user?.id ?? null })
        .select("*")
        .single();
      if (error) throw error;
      return data as Row;
    },
    onSuccess: (row) => {
      toast.success(editing ? "Event diperbarui" : "Event ditambahkan");
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
      void qc.invalidateQueries({ queryKey: ["event-photos"] });
      if (row) setPhotoRow(row);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("photos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Event dihapus");
      void qc.invalidateQueries({ queryKey: ["event-photos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (list.data ?? []).filter((r) =>
    q.trim()
      ? `${String(r["judul"] ?? "")} ${String(r["deskripsi"] ?? "")}`
          .toLowerCase()
          .includes(q.trim().toLowerCase())
      : true,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Event</h1>
          <p className="text-sm text-muted-foreground">
            Catat event, lalu unggah foto sekaligus (bulk) langsung ke Google Drive aktif pada folder
            sesuai nama event.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari event…"
              className="w-64 pl-9"
            />
          </div>
          {canWrite ? (
            <Button
              onClick={() => {
                setEditing(null);
                setForm(emptyForm);
                setOpen(true);
              }}
            >
              <Plus className="size-4" /> Tambah
            </Button>
          ) : null}
        </div>
      </div>

      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-xs tracking-wide text-muted-foreground uppercase">
              <th className="px-4 py-3 font-medium">Nama Event</th>
              <th className="px-4 py-3 font-medium">Deskripsi</th>
              <th className="px-4 py-3 font-medium">Tanggal</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {list.isLoading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  Memuat data…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  Belum ada event.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={String(row["id"])}
                  className="border-b border-border/40 last:border-0 hover:bg-secondary/40"
                >
                  <td className="px-4 py-3 font-medium">{String(row["judul"] ?? "—")}</td>
                  <td className="max-w-[24rem] px-4 py-3 text-muted-foreground">
                    <span className="line-clamp-2">{String(row["deskripsi"] ?? "—")}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{fmt(row["tanggal"])}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="secondary" onClick={() => setPhotoRow(row)}>
                        Foto
                      </Button>
                      {canWrite ? (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Ubah"
                            onClick={() => {
                              setEditing(row);
                              setForm({
                                judul: String(row["judul"] ?? ""),
                                deskripsi: String(row["deskripsi"] ?? ""),
                                tanggal: row["tanggal"] ? String(row["tanggal"]).slice(0, 10) : "",
                              });
                              setOpen(true);
                            }}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Hapus"
                            onClick={() => {
                              void confirmDialog({
                                title: "Hapus event ini?",
                                description:
                                  "Data event dihapus dari aplikasi. Foto yang sudah terunggah tetap tersimpan di Google Drive.",
                                confirmText: "Hapus",
                                destructive: true,
                              }).then((ok) => {
                                if (ok) remove.mutate(String(row["id"]));
                              });
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Ubah Event" : "Tambah Event"}</DialogTitle>
            <DialogDescription>
              Setelah disimpan, galeri foto event akan terbuka untuk unggah foto bulk.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="judul">Nama Event</Label>
              <Input
                id="judul"
                value={form.judul}
                onChange={(e) => setForm((f) => ({ ...f, judul: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="desk">Deskripsi</Label>
              <Textarea
                id="desk"
                value={form.deskripsi}
                onChange={(e) => setForm((f) => ({ ...f, deskripsi: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tgl">Tanggal</Label>
              <DatePickerField
                id="tgl"
                value={form.tanggal}
                onChange={(v) => setForm((f) => ({ ...f, tanggal: v }))}
              />
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

      <Dialog open={!!photoRow} onOpenChange={(o) => !o && setPhotoRow(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{String(photoRow?.["judul"] ?? "Foto Event")}</DialogTitle>
            <DialogDescription>
              Foto tersimpan di Google Drive aktif: folder utama aplikasi → Foto Event → nama event.
            </DialogDescription>
          </DialogHeader>
          {photoRow ? (
            <PhotoGallery
              entity="event"
              entityId={String(photoRow["id"])}
              subfolder={String(photoRow["judul"] ?? "")}
              canEdit={canWrite}
              title="Upload Foto (bisa banyak sekaligus)"
            />
          ) : null}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setPhotoRow(null)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
