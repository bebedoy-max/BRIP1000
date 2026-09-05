import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, ImageOff } from "lucide-react";
import { db, driveFull, driveThumb, type EventPhoto } from "@/lib/face";
import { getPublicEventPhotoPage } from "@/lib/public-events.functions";
import { purgeMissingPhoto } from "@/lib/photo-cleanup.functions";

const PAGE_SIZE = 48;

/** Buang prefix teknis "EVT-<uuid>-<angka>_" dari nama file agar judul rapi. */
function cleanFileName(name?: string | null) {
  if (!name) return "Foto event";
  const cleaned = name.replace(/^EVT-[0-9a-fA-F-]{36}[-\d]*_/, "").replace(/^[-\d]+_/, "");
  return cleaned || name;
}

/**
 * Grid galeri foto event (thumbnail Drive + infinite scroll).
 * Isi grid bisa difilter per event atau per pekerja (dari semua event).
 */
export function EventPhotoGrid({
  eventId,
  workerId,
  publicAccess = false,
  emptyText = "Belum ada foto.",
}: {
  eventId?: string;
  workerId?: string;
  publicAccess?: boolean;
  emptyText?: string;
}) {
  const [preview, setPreview] = useState<EventPhoto | null>(null);
  const [broken, setBroken] = useState<string[]>([]);
  const sentinel = useRef<HTMLDivElement | null>(null);
  const publicPhotoPage = useServerFn(getPublicEventPhotoPage);
  const purge = useServerFn(purgeMissingPhoto);

  /** Foto yang file Drive-nya sudah hilang: sembunyikan & bersihkan datanya. */
  const handleBroken = (fileId: string) => {
    setBroken((prev) => (prev.includes(fileId) ? prev : [...prev, fileId]));
    void purge({ data: { kind: "event", driveFileId: fileId } }).catch(() => undefined);
  };

  const q = useInfiniteQuery({
    queryKey: ["event-photo-grid", eventId ?? null, workerId ?? null, publicAccess],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      if (publicAccess) {
        const payload: { offset: number; limit: number; eventId?: string } = {
          offset: pageParam as number,
          limit: PAGE_SIZE,
        };
        if (eventId) payload.eventId = eventId;
        return (await publicPhotoPage({
          data: payload,
        })) as EventPhoto[];
      }
      let query = db
        .from("event_photos")
        .select("id,event_id,drive_file_id,drive_view_link,file_name,matched_worker_ids,processed_at")
        .order("processed_at", { ascending: false })
        .range(pageParam as number, (pageParam as number) + PAGE_SIZE - 1);
      if (eventId) query = query.eq("event_id", eventId);
      if (workerId) query = query.contains("matched_worker_ids", [workerId]);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as EventPhoto[];
    },
    getNextPageParam: (last, all) =>
      last.length < PAGE_SIZE ? undefined : all.length * PAGE_SIZE,
  });

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && q.hasNextPage && !q.isFetchingNextPage) {
        void q.fetchNextPage();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [q.hasNextPage, q.isFetchingNextPage, q]);

  const photos = (q.data?.pages ?? []).flat().filter((p) => !broken.includes(p.drive_file_id));

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Memuat foto…</p>;
  if (q.isError)
    return <p className="text-sm text-destructive">Gagal memuat foto. Coba muat ulang halaman.</p>;
  if (!photos.length)
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
        <ImageOff className="size-6" />
        <p className="text-sm">{emptyText}</p>
      </div>
    );

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {photos.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPreview(p)}
            className="group overflow-hidden rounded-xl border border-border/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-label={`Buka foto ${p.file_name ?? ""}`}
          >
            <img
              src={driveThumb(p.drive_file_id)}
              alt={p.file_name ?? "Foto event"}
              loading="lazy"
              onError={() => handleBroken(p.drive_file_id)}
              className="aspect-square w-full object-cover transition-transform duration-200 group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      <div ref={sentinel} className="h-8" />
      {q.isFetchingNextPage ? (
        <p className="text-center text-sm text-muted-foreground">Memuat foto berikutnya…</p>
      ) : null}

      <Dialog open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="truncate text-base" title={preview?.file_name ?? undefined}>
              {cleanFileName(preview?.file_name)}
            </DialogTitle>
          </DialogHeader>
          {preview ? (
            <div className="space-y-3">
              <img
                src={driveFull(preview.drive_file_id)}
                alt={preview.file_name ?? "Foto event"}
                className="max-h-[70vh] w-full rounded-xl object-contain"
              />
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>
                  {new Date(preview.processed_at).toLocaleString("id-ID", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
                <Button asChild size="sm" variant="secondary">
                  <a href={preview.drive_view_link} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" /> Buka di Drive
                  </a>
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
