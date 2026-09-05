import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  infoKinds,
  infoTransitions,
  loadInfoSlidesAll,
  type InfoKind,
  type InfoSlide,
  type InfoTransition,
} from "@/lib/info-board";

const db = supabase as unknown as SupabaseClient;

type Form = {
  judul: string;
  jenis: InfoKind;
  isi: string;
  media_url: string;
  durasi: number;
  transisi: InfoTransition;
  aktif: boolean;
  urutan: number;
};

const emptyForm: Form = {
  judul: "",
  jenis: "text",
  isi: "",
  media_url: "",
  durasi: 8,
  transisi: "fade",
  aktif: true,
  urutan: 1,
};

const selectClass =
  "h-10 w-full rounded-xl border border-input bg-popover px-3 text-sm";

/** Pengelolaan konten papan informasi digital pada dashboard. */
export function InfoBoardManager({ canWrite }: { canWrite: boolean }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Form>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);

  const list = useQuery({ queryKey: ["info-board-all"], queryFn: loadInfoSlidesAll });
  const rows = list.data ?? [];

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["info-board-all"] });
    void qc.invalidateQueries({ queryKey: ["info-board-slides"] });
  };

  const reset = () => {
    setForm({ ...emptyForm, urutan: rows.length + 1 });
    setEditId(null);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.judul.trim()) throw new Error("Judul wajib diisi");
      if (form.jenis !== "text" && !form.media_url.trim())
        throw new Error("URL gambar/video wajib diisi");
      const payload = {
        judul: form.judul.trim(),
        jenis: form.jenis,
        isi: form.isi.trim() || null,
        media_url: form.media_url.trim() || null,
        durasi: Math.max(2, Math.min(600, Number(form.durasi) || 8)),
        transisi: form.transisi,
        aktif: form.aktif,
        urutan: Number(form.urutan) || 1,
      };
      const { error } = editId
        ? await db.from("info_board_slides").update(payload).eq("id", editId)
        : await db.from("info_board_slides").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(editId ? "Slide diperbarui" : "Slide ditambahkan");
      reset();
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("info_board_slides").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Slide dihapus");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const edit = (s: InfoSlide) => {
    setEditId(s.id);
    setForm({
      judul: s.judul,
      jenis: s.jenis,
      isi: s.isi ?? "",
      media_url: s.media_url ?? "",
      durasi: s.durasi,
      transisi: s.transisi,
      aktif: s.aktif,
      urutan: s.urutan,
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Papan Informasi Digital</h1>
        <p className="text-sm text-muted-foreground">
          Konten informasi BRI Kantor Cabang Pringsewu yang tampil sebagai slide di atas kolom
          berita. Isi bisa berupa teks, gambar, atau video; video berganti otomatis saat selesai,
          teks & gambar mengikuti durasi yang diatur.
        </p>
      </div>

      <div className="glass-card space-y-4 p-4">
        <h2 className="text-sm font-semibold">{editId ? "Ubah Slide" : "Tambah Slide"}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="judul">Judul</Label>
            <Input
              id="judul"
              value={form.judul}
              disabled={!canWrite}
              onChange={(e) => setForm((f) => ({ ...f, judul: e.target.value }))}
              placeholder="Contoh: Layanan Weekend Banking"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="jenis">Jenis Konten</Label>
            <select
              id="jenis"
              className={selectClass}
              value={form.jenis}
              disabled={!canWrite}
              onChange={(e) => setForm((f) => ({ ...f, jenis: e.target.value as InfoKind }))}
            >
              {infoKinds.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="transisi">Efek Transisi</Label>
            <select
              id="transisi"
              className={selectClass}
              value={form.transisi}
              disabled={!canWrite}
              onChange={(e) =>
                setForm((f) => ({ ...f, transisi: e.target.value as InfoTransition }))
              }
            >
              {infoTransitions.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {form.jenis !== "text" ? (
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="media">
                {form.jenis === "image" ? "URL Gambar / ID Google Drive" : "URL Video / YouTube"}
              </Label>
              <Input
                id="media"
                value={form.media_url}
                disabled={!canWrite}
                onChange={(e) => setForm((f) => ({ ...f, media_url: e.target.value }))}
                placeholder={
                  form.jenis === "image"
                    ? "https://… atau 1AbCdEf_driveFileId"
                    : "https://…/video.mp4 atau https://youtu.be/…"
                }
              />
            </div>
          ) : null}

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="isi">{form.jenis === "text" ? "Isi Informasi" : "Keterangan"}</Label>
            <Textarea
              id="isi"
              rows={4}
              value={form.isi}
              disabled={!canWrite}
              onChange={(e) => setForm((f) => ({ ...f, isi: e.target.value }))}
              placeholder="Tulis informasi di sini…"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="durasi">Durasi Tampil (detik)</Label>
            <Input
              id="durasi"
              type="number"
              min={2}
              max={600}
              value={form.durasi}
              disabled={!canWrite}
              onChange={(e) => setForm((f) => ({ ...f, durasi: Number(e.target.value) }))}
            />
            <p className="text-xs text-muted-foreground">
              Video file mengikuti panjang videonya; durasi ini dipakai untuk teks, gambar, dan
              video YouTube.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="urutan">Urutan</Label>
            <Input
              id="urutan"
              type="number"
              min={1}
              value={form.urutan}
              disabled={!canWrite}
              onChange={(e) => setForm((f) => ({ ...f, urutan: Number(e.target.value) }))}
            />
          </div>

          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Checkbox
              checked={form.aktif}
              disabled={!canWrite}
              onCheckedChange={(v) => setForm((f) => ({ ...f, aktif: !!v }))}
            />
            Tampilkan slide ini di dashboard
          </label>
        </div>

        <div className="flex gap-2">
          <Button disabled={!canWrite || save.isPending} onClick={() => save.mutate()}>
            {editId ? "Simpan Perubahan" : "Tambah Slide"}
          </Button>
          {editId ? (
            <Button variant="secondary" onClick={reset}>
              Batal
            </Button>
          ) : null}
        </div>
      </div>

      <div className="glass-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Daftar Slide</h2>
        {list.isLoading ? (
          <p className="text-sm text-muted-foreground">Memuat…</p>
        ) : !rows.length ? (
          <p className="text-sm text-muted-foreground">Belum ada konten papan informasi.</p>
        ) : (
          <div className="rounded-xl border border-border/60">
            {rows.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center gap-3 border-b border-border/40 px-3 py-2.5 text-sm last:border-0"
              >
                <span className="w-8 shrink-0 text-xs text-muted-foreground">{s.urutan}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{s.judul}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {infoKinds.find((k) => k.value === s.jenis)?.label} ·{" "}
                  {infoTransitions.find((t) => t.value === s.transisi)?.label} · {s.durasi}s
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${
                    s.aktif ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {s.aktif ? "Aktif" : "Nonaktif"}
                </span>
                <Button size="sm" variant="secondary" disabled={!canWrite} onClick={() => edit(s)}>
                  Ubah
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={!canWrite || remove.isPending}
                  onClick={() => remove.mutate(s.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
