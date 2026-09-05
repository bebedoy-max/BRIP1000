import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Clock, ScanFace, Upload, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  db,
  FACE_BUCKET,
  WORKER_FACE_COLUMNS,
  faceStatusLabel,
  facePercent,
  faceStatusVariant,
  type FaceStatus,
  type WorkerFace,
} from "@/lib/face";


/**
 * Tombol + dialog "Foto Wajah" pada menu Data Pekerja.
 * Web app hanya menyimpan foto master ke Storage dan menandai status
 * `pending`; perhitungan embedding dilakukan companion app.
 */
export function WorkerFaceButton({
  workerId,
  personalNumber,
  nama,
  canWrite,
}: {
  workerId: string;
  personalNumber: string;
  nama: string;
  canWrite: boolean;
}) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const face = useQuery({
    queryKey: ["worker-face", workerId],
    queryFn: async () => {
      const { data, error } = await db
        .from("worker_faces")
        .select(WORKER_FACE_COLUMNS)
        .eq("worker_id", workerId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as WorkerFace | null;
    },
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!personalNumber) throw new Error("Pekerja belum punya Personal Number");
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${personalNumber}-${Date.now()}.${ext}`;
      const { error: upErr } = await db.storage
        .from(FACE_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = db.storage.from(FACE_BUCKET).getPublicUrl(path);
      const { data: auth } = await db.auth.getUser();
      const { error } = await db.from("worker_faces").upsert(
        {
          worker_id: workerId,
          personal_number: personalNumber,
          reference_photo_url: pub.publicUrl,
          status: "pending",
          note: null,
          updated_by: auth.user?.id ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "personal_number" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Foto master tersimpan. Menunggu diproses companion app.");
      void qc.invalidateQueries({ queryKey: ["worker-face", workerId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const status = (face.data?.status ?? null) as FaceStatus | null;
  const percent = facePercent(face.data?.quality);
  const hasPhoto = Boolean(face.data?.reference_photo_url) && status != null;

  const statusIcon =
    status === "indexed" ? (
      <CheckCircle2 className="size-4 text-emerald-500" />
    ) : status === "failed" ? (
      <AlertTriangle className="size-4 text-destructive" />
    ) : (
      <Clock className="size-4 text-amber-500" />
    );

  const statusText =
    status === "indexed"
      ? percent != null
        ? `Index OK — ${percent}%`
        : "Index OK"
      : status === "failed"
        ? "Index Gagal"
        : "Menunggu Index";

  return (
    <>
      {hasPhoto ? (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setOpen(true)}
          title="Lihat foto master wajah"
        >
          {statusIcon}
          {statusText}
        </Button>
      ) : (
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          <ScanFace className="size-4" /> Foto Wajah
        </Button>
      )}


      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Foto Master Wajah — {nama}</DialogTitle>
            <DialogDescription>
              Satu foto wajah jelas, pencahayaan baik, dan hanya berisi satu orang.
            </DialogDescription>
          </DialogHeader>

          {face.isLoading ? (
            <p className="text-sm text-muted-foreground">Memuat data…</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="size-28 overflow-hidden rounded-2xl border border-border/60 bg-muted">
                  {face.data?.reference_photo_url ? (
                    <img
                      src={face.data.reference_photo_url}
                      alt={`Foto master wajah ${nama}`}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                      Belum ada
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  {status ? (
                    <Badge variant={faceStatusVariant[status]}>
                      {status === "indexed" && percent != null
                        ? `Index OK — ${percent}%`
                        : faceStatusLabel[status]}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Belum ada foto master</Badge>
                  )}
                  {face.data?.note ? (
                    <p className="text-xs text-muted-foreground">{face.data.note}</p>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    Personal Number: {personalNumber || "—"}
                  </p>
                </div>
              </div>

              {canWrite ? (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) upload.mutate(f);
                    }}
                  />
                  <Button
                    className="w-full"
                    disabled={upload.isPending}
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload className="size-4" />
                    {upload.isPending
                      ? "Mengunggah…"
                      : face.data
                        ? "Ganti Foto Master"
                        : "Unggah Foto Master"}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Setelah diunggah, status menjadi “Menunggu diproses”. Companion app akan
                    menghitung embedding wajah dan mengubah status menjadi “Terindeks”.
                  </p>
                </>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
