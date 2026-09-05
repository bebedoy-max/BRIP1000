import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";
import { db } from "@/lib/face";
import { RotatingThumbGrid } from "@/components/RotatingThumbGrid";
import {
  getPublicEventPhotoCounts,
  getPublicEventPhotoPage,
} from "@/lib/public-events.functions";
import { getEventLikes } from "@/lib/event-likes.functions";
import { EventCardActions } from "@/components/EventCardActions";


type EventRow = {
  id: string;
  nama_event: string;
  deskripsi: string | null;
  tanggal_mulai: string | null;
};

export type EventSummaryRow = EventRow & { photos: string[]; photoCount: number };

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("id-ID", { dateStyle: "medium" }) : "—";

const THUMBS_PER_EVENT = 12;

/** Ambil foto & jumlah foto satu event; jatuh ke server function bila RLS menutup akses. */
async function loadOneEvent(e: EventRow, fallbackCounts: Record<string, number>): Promise<EventSummaryRow> {
  let photos: string[] = [];
  let photoCount = 0;

  const [{ data: rows }, { count }] = await Promise.all([
    db
      .from("event_photos")
      .select("drive_file_id,processed_at")
      .eq("event_id", e.id)
      .order("processed_at", { ascending: false })
      .limit(THUMBS_PER_EVENT),
    db
      .from("event_photos")
      .select("id", { count: "exact", head: true })
      .eq("event_id", e.id),
  ]);

  photos = ((rows ?? []) as { drive_file_id: string }[]).map((p) => p.drive_file_id);
  photoCount = count ?? 0;

  if (!photos.length) {
    try {
      const fallback = await getPublicEventPhotoPage({
        data: { eventId: e.id, limit: THUMBS_PER_EVENT },
      });
      photos = fallback.map((p) => p.drive_file_id);
    } catch {
      /* biarkan kosong */
    }
  }
  if (!photoCount) photoCount = fallbackCounts[e.id] ?? photos.length;

  return { ...e, photos, photoCount };
}

async function loadEventSummary(): Promise<EventSummaryRow[]> {
  const { data, error } = await db
    .from("events")
    .select("id,nama_event,deskripsi,tanggal_mulai")
    .order("tanggal_mulai", { ascending: false, nullsFirst: false });
  if (error) throw error;
  const events = (data ?? []) as EventRow[];
  if (!events.length) return [];
  let counts: Record<string, number> = {};
  try {
    counts = await getPublicEventPhotoCounts();
  } catch {
    counts = {};
  }
  return Promise.all(events.map((e) => loadOneEvent(e, counts)));
}



/**
 * Kluster kartu event berjalan: tiap kartu memuat grid thumbnail foto event
 * yang terus berganti secara acak.
 */
export function EventSummary({ limit }: { limit?: number }) {
  const q = useQuery({ queryKey: ["events-thumb-summary"], queryFn: loadEventSummary });
  const rows = useMemo(() => (q.data ?? []).slice(0, limit ?? 100), [q.data, limit]);
  const fromPath = useRouterState({ select: (st) => st.location.pathname });
  const likesQuery = useQuery({
    queryKey: ["event-likes"],
    queryFn: async () => {
      try {
        return await getEventLikes();
      } catch {
        return [];
      }
    },
  });
  const likeMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of likesQuery.data ?? []) map[row.event_id] = row.likes;
    return map;
  }, [likesQuery.data]);

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Memuat event…</p>;
  if (!rows.length) return <p className="text-sm text-muted-foreground">Belum ada event berjalan.</p>;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((e) => {
        const card = (
          <>
            <RotatingThumbGrid photos={e.photos} alt={`Foto event ${e.nama_event}`} />
            <div className="mt-3">
              <h3 className="font-semibold">{e.nama_event}</h3>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="size-3.5" /> {fmt(e.tanggal_mulai)} · {e.photoCount} foto
              </p>
              {e.deskripsi ? (
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{e.deskripsi}</p>
              ) : null}
            </div>
          </>
        );

        const base =
          "block rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

        return (
          <div
            key={e.id}
            className="glass-card p-4 transition-transform duration-200 hover:-translate-y-0.5 hover:border-primary/50"
          >
            <Link
              to="/event/$id"
              params={{ id: e.id }}
              search={{ from: fromPath }}
              aria-label={`Lihat foto event ${e.nama_event}`}
              className={base}
            >
              {card}
            </Link>
            <EventCardActions
              eventId={e.id}
              eventName={e.nama_event}
              likes={likeMap[e.id] ?? 0}
            />
          </div>
        );
      })}

    </div>
  );
}
