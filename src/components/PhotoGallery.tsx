import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { driveImageUrl, type PhotoEntity } from "@/lib/drive-entities";
import { uploadEntityPhoto, deleteEntityPhoto } from "@/lib/drive.functions";
import { purgeMissingPhoto } from "@/lib/photo-cleanup.functions";

const db = supabase as unknown as SupabaseClient;

type PhotoRow = {
  id: string;
  drive_file_id: string;
  file_name: string | null;
};


function toBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Gagal membaca file"));
    reader.readAsDataURL(file);
  });
}

/** Galeri foto sebuah data, tersimpan di Google Drive aplikasi. */
export function PhotoGallery({
  entity,
  entityId,
  canEdit = false,
  title = "Foto",
  subfolder,
}: {
  entity: PhotoEntity;
  entityId: string;
  canEdit?: boolean;
  title?: string;
  subfolder?: string;
}) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const upload = useServerFn(uploadEntityPhoto);
  const remove = useServerFn(deleteEntityPhoto);
  const purge = useServerFn(purgeMissingPhoto);
  const [broken, setBroken] = useState<string[]>([]);

  /** File Drive hilang → sembunyikan dan bersihkan datanya otomatis. */
  const handleBroken = (fileId: string) => {
    setBroken((prev) => (prev.includes(fileId) ? prev : [...prev, fileId]));
    void purge({ data: { kind: "entity", driveFileId: fileId } }).catch(() => undefined);
  };

  const photos = useQuery<PhotoRow[]>({
    queryKey: ["entity_photos", entity, entityId],
    enabled: !!entityId,
    queryFn: async () => {
      const { data, error } = await db
        .from("entity_photos")
        .select("id,drive_file_id,file_name")
        .eq("entity_type", entity)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PhotoRow[];
    },
  });


  const invalidate = () =>
    void qc.invalidateQueries({ queryKey: ["entity_photos", entity, entityId] });

  const uploading = useMutation({
    mutationFn: async (files: File[]) => {
      for (const file of files) {
        await upload({
          data: {
            entity,
            entityId,
            fileName: file.name,
            mimeType: file.type,
            base64: await toBase64(file),
            subfolder,
          },
        });
      }
    },
    onSuccess: () => {
      toast.success("Foto terunggah ke Google Drive");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removing = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Foto dihapus");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const items = (photos.data ?? []).filter((p) => !broken.includes(p.drive_file_id));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        {canEdit && entityId && entity !== "pegawai" ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={uploading.isPending}
              onClick={() => inputRef.current?.click()}
            >
              <ImagePlus className="size-4" />
              {uploading.isPending ? "Mengunggah…" : "Tambah Foto"}
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (files.length) uploading.mutate(files);
              }}
            />
          </>
        ) : null}
      </div>

      {photos.isLoading ? (
        <p className="text-xs text-muted-foreground">Memuat foto…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground">Belum ada foto.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {items.map((p) => (
            <div key={p.id} className="group relative overflow-hidden rounded-xl border border-border/60">
              <img
                src={driveImageUrl(p.drive_file_id, 600)}
                alt={p.file_name ?? "Foto"}
                loading="lazy"
                onError={() => handleBroken(p.drive_file_id)}
                className="h-28 w-full cursor-zoom-in object-cover"
                onClick={() => setPreview(p.drive_file_id)}
              />
              {canEdit ? (
                <button
                  type="button"
                  aria-label="Hapus foto"
                  className="absolute right-1 top-1 rounded-lg bg-background/80 p-1 opacity-0 transition group-hover:opacity-100"
                  onClick={() => removing.mutate(p.id)}
                >
                  <Trash2 className="size-4 text-destructive" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          {preview ? (
            <img src={driveImageUrl(preview, 1600)} alt="Foto" className="w-full rounded-xl" />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
