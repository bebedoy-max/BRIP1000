import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2, Upload } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useServerFn } from "@tanstack/react-start";
import { finalizeInfoMedia, infoMediaUploadUrl } from "@/lib/info-board.functions";
import {
  infoDriveId,
  infoKinds,
  infoMediaSrc,
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
  transisi_ms: number;
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
  transisi_ms: 500,
  aktif: true,
  urutan: 1,
};

const selectClass =
  "h-10 w-full rounded-xl border border-input bg-popover px-3 text-sm";

const CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB (kelipatan 256 KB sesuai aturan Google)
const MAX_RETRY = 4;
const PROXY_URL = "/api/info-media/upload";

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Token sesi login, dipakai untuk mengamankan jalur unggah di server. */
async function authToken() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sesi login berakhir. Silakan masuk ulang.");
  return token;
}

/** Kirim satu potongan (atau tanya posisi byte) lewat server aplikasi. */
async function proxyPut(opts: {
  token: string;
  uploadUrl: string;
  range: string;
  fileType?: string;
  body?: Blob | null;
}) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${opts.token}`,
    "x-upload-url": opts.uploadUrl,
    "x-content-range": opts.range,
    "content-type": "application/octet-stream",
  };
  if (opts.fileType) headers["x-file-type"] = opts.fileType;
  return fetch(PROXY_URL, { method: "PUT", headers, body: opts.body ?? null });
}

/** Tanya Google sudah sampai byte berapa upload diterima (untuk lanjut ulang). */
async function queryUploadedBytes(token: string, uploadUrl: string, total: number) {
  const res = await proxyPut({ token, uploadUrl, range: `bytes */${total}` });
  const m = res.headers.get("x-google-range")?.match(/bytes=0-(\d+)/);
  return m ? Number(m[1]) + 1 : 0;
}

/**
 * Unggah resumable per potongan (chunk) melalui server aplikasi, dengan
 * percobaan ulang otomatis — tahan terhadap koneksi yang putus di tengah
 * untuk file video besar.
 */
async function resumableUpload(
  uploadUrl: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<{ id: string }> {
  const token = await authToken();
  const total = file.size;
  let offset = 0;
  let attempt = 0;

  while (offset < total) {
    const end = Math.min(offset + CHUNK_SIZE, total);
    const last = end === total;
    try {
      const res = await proxyPut({
        token,
        uploadUrl,
        range: `bytes ${offset}-${end - 1}/${total}`,
        fileType: file.type,
        body: file.slice(offset, end),
      });
      if (res.status === 208) {
        // Potongan diterima, lanjut potongan berikutnya.
        offset = end;
        attempt = 0;
        onProgress(Math.round((offset / total) * 100));
        continue;
      }
      if (res.ok) {
        if (!last) {
          offset = end;
          attempt = 0;
          onProgress(Math.round((offset / total) * 100));
          continue;
        }
        onProgress(100);
        return JSON.parse(await res.text()) as { id: string };
      }
      if (res.status >= 500 || res.status === 429) throw new Error(`server ${res.status}`);
      const body = await res.text();
      throw new Error(`Gagal unggah [${res.status}]: ${body.slice(0, 200)}`);
    } catch (e) {
      // Kesalahan validasi (4xx selain 429) jangan diulang.
      if (e instanceof Error && e.message.startsWith("Gagal unggah")) throw e;
      attempt += 1;
      if (attempt > MAX_RETRY) {
        throw new Error("Koneksi terputus saat mengunggah. Coba lagi dengan koneksi stabil.");
      }
      await delay(1000 * attempt);
      offset = await queryUploadedBytes(token, uploadUrl, total);
      onProgress(Math.round((offset / total) * 100));
    }
  }
  throw new Error("Unggahan selesai tanpa respons dari Google.");
}


/** Pengelolaan konten papan informasi digital pada dashboard. */
export function InfoBoardManager({ canWrite }: { canWrite: boolean }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Form>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const getUploadUrl = useServerFn(infoMediaUploadUrl);
  const finalize = useServerFn(finalizeInfoMedia);

  // Unggah gambar/video langsung ke Google Drive (folder SUPER IT DATA →
  // "Media Papan Informasi"), lalu simpan ID filenya sebagai media slide.
  const pickFile = async (file: File) => {
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (!isImage && !isVideo) {
      toast.error("File harus berupa gambar atau video.");
      return;
    }
    setProgress(0);
    try {
      const { uploadUrl } = await getUploadUrl({
        data: { fileName: file.name, mimeType: file.type },
      });
      const uploaded = await resumableUpload(uploadUrl, file, setProgress);
      await finalize({ data: { fileId: uploaded.id } });
      setForm((f) => ({
        ...f,
        jenis: isVideo ? "video" : "image",
        media_url: uploaded.id,
      }));
      toast.success("File tersimpan di Google Drive");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

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
        throw new Error("Foto/video wajib diunggah");
      const payload = {
        judul: form.judul.trim(),
        jenis: form.jenis,
        isi: form.isi.trim() || null,
        media_url: form.media_url.trim() || null,
        durasi: Math.max(2, Math.min(600, Number(form.durasi) || 8)),
        transisi: form.transisi,
        transisi_ms: Math.max(100, Math.min(5000, Number(form.transisi_ms) || 500)),
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
      transisi_ms: s.transisi_ms ?? 500,
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

          <div className="grid gap-2">
            <Label htmlFor="transisi-ms">Durasi Efek Transisi (milidetik)</Label>
            <Input
              id="transisi-ms"
              type="number"
              min={100}
              max={5000}
              step={50}
              value={form.transisi_ms}
              disabled={!canWrite}
              onChange={(e) => setForm((f) => ({ ...f, transisi_ms: Number(e.target.value) }))}
            />
            <p className="text-xs text-muted-foreground">
              Kecepatan animasi saat berpindah slide. 500 ms = 0,5 detik.
            </p>
          </div>

          {form.jenis !== "text" ? (
            <div className="grid gap-2 sm:col-span-2">
              <Label>{form.jenis === "image" ? "Gambar" : "Video"}</Label>
              <input
                ref={fileRef}
                type="file"
                accept={form.jenis === "image" ? "image/*" : "video/*"}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void pickFile(f);
                }}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!canWrite || progress !== null}
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="mr-2 size-4" />
                  {progress !== null
                    ? `Mengunggah… ${progress}%`
                    : form.jenis === "image"
                      ? "Upload Foto"
                      : "Upload Video"}
                </Button>
                {form.media_url ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={!canWrite || progress !== null}
                    onClick={() => setForm((f) => ({ ...f, media_url: "" }))}
                  >
                    Hapus media
                  </Button>
                ) : null}
              </div>
              {form.media_url ? (
                form.jenis === "image" ? (
                  <img
                    src={infoMediaSrc(form.media_url, 600)}
                    alt="Pratinjau"
                    className="max-h-40 w-full rounded-xl object-cover"
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Video siap: {infoDriveId(form.media_url) ?? form.media_url}
                  </p>
                )
              ) : (
                <p className="text-xs text-muted-foreground">
                  File tersimpan otomatis di Google Drive folder SUPER IT DATA → Media Papan
                  Informasi.
                </p>
              )}
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
                  {infoTransitions.find((t) => t.value === s.transisi)?.label} ({s.transisi_ms ?? 500}
                  ms) · {s.durasi}s
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
