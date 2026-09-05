import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PhotoCropDialog } from "@/components/PhotoCropDialog";
import { compressImage, pickImage } from "@/lib/absensi-ui";
import { db } from "@/lib/face";
import { fetchVoteImage, listVoteWorkerPhotos } from "@/lib/vote.functions";

/**
 * Tombol "Foto Profil" pada menu Data Pekerja: pilih foto dari foto-foto event
 * pekerja tersebut (atau unggah), lalu crop/zoom/aspek rasio seperti di menu Vote.
 */
export function WorkerProfilePhotoButton({
  workerId,
  personalNumber,
  nama,
  photo,
  canWrite,
}: {
  workerId: string;
  personalNumber: string;
  nama: string;
  photo: string | null;
  canWrite: boolean;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  const photos = useQuery({
    queryKey: ["worker-profile-photos", workerId, personalNumber],
    enabled: pickerOpen,
    queryFn: () =>
      listVoteWorkerPhotos({
        data: {
          workerId,
          personalNumber: personalNumber.trim() || undefined,
        },
      }),
  });

  const save = useMutation({
    mutationFn: async (value: string | null) => {
      const { error } = await db
        .from("employees")
        .update({ n: value, updated_at: new Date().toISOString() })
        .eq("id", workerId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Foto profil tersimpan");
      void qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** Ambil foto pilihan lewat server (bebas CORS) lalu buka dialog crop. */
  const usePhoto = async (url: string) => {
    try {
      const src = url.startsWith("data:")
        ? url
        : (await fetchVoteImage({ data: { url } })).dataUrl;
      setPickerOpen(false);
      setCropSrc(src);
    } catch {
      toast.error("Foto gagal dimuat.");
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant={photo ? "secondary" : "outline"}
        className="gap-2"
        onClick={() => setOpen(true)}
        title="Foto profil pekerja"
      >
        {photo ? (
          <img src={photo} alt={nama} className="size-5 rounded-full object-cover" />
        ) : (
          <UserRound className="size-4" />
        )}
        {photo ? "Foto Profil" : "Set Foto"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Foto Profil — {nama}</DialogTitle>
            <DialogDescription>
              Pilih dari foto event pekerja ini atau unggah, lalu atur aspek rasio, zoom, dan crop.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-center">
            <div className="size-40 overflow-hidden rounded-xl border border-border bg-muted">
              {photo ? (
                <img src={photo} alt={nama} className="size-full object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                  Belum ada foto
                </div>
              )}
            </div>
          </div>

          {canWrite ? (
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
                <UserRound className="size-4" /> Ambil dari Foto Event
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const img = await pickImage();
                  if (!img) return;
                  setCropSrc(img);
                }}
              >
                <ImagePlus className="size-4" /> Unggah Foto
              </Button>
              {photo ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={save.isPending}
                  onClick={() => save.mutate(null)}
                >
                  <Trash2 className="size-4" /> Hapus
                </Button>
              ) : null}
            </div>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              Hanya IT Admin yang dapat mengubah foto profil.
            </p>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Foto Event Pekerja</DialogTitle>
          </DialogHeader>
          {photos.isLoading ? (
            <p className="text-sm text-muted-foreground">Memuat foto...</p>
          ) : (photos.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada foto untuk pekerja ini di database.
            </p>
          ) : (
            /*
              Thumbnail ditampilkan dengan aspek rasio ASLI (tanpa crop) agar
              wajah tetap terlihat, dan daftarnya discroll di dalam dialog.
              Masonry 2 kolom: foto panorama lebar maupun potrait tetap utuh.
            */
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="columns-1 gap-3 sm:columns-2">
                {(photos.data ?? []).map((p, i) => (
                  <button
                    key={`${p.url}-${i}`}
                    type="button"
                    className="group mb-3 block w-full break-inside-avoid overflow-hidden rounded-lg border border-border"
                    onClick={() => void usePhoto(p.url)}
                  >
                    <img
                      src={p.url}
                      alt={p.label}
                      loading="lazy"
                      decoding="async"
                      className="block w-full transition group-hover:scale-[1.02]"
                    />
                    <span className="block truncate p-1 text-[10px] text-muted-foreground">
                      {p.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPickerOpen(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PhotoCropDialog
        open={!!cropSrc}
        src={cropSrc}
        onOpenChange={(v) => {
          if (!v) setCropSrc(null);
        }}
        onDone={(url) => {
          void (async () => {
            const small = await compressImage(url, 640, 0.85);
            save.mutate(small);
          })();
        }}
      />
    </>
  );
}
