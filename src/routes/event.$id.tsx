import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { PublicLayout } from "@/components/PublicLayout";
import { EventPhotoGrid } from "@/components/EventPhotoGrid";
import { db } from "@/lib/face";

type EventRow = {
  id: string;
  nama_event: string;
  deskripsi: string | null;
  tanggal_mulai: string | null;
};

export const Route = createFileRoute("/event/$id")({
  validateSearch: (search: Record<string, unknown>): { from?: string } => {
    const out: { from?: string } = {};
    if (typeof search["from"] === "string") out.from = search["from"];
    return out;
  },
  head: () => ({
    meta: [
      { title: "Galeri Event — BRI BO Pringsewu" },
      { name: "description", content: "Galeri foto acara dan kegiatan BRI Branch Office Pringsewu yang dapat dilihat pengunjung umum." },
      { property: "og:title", content: "Galeri Event — BRI BO Pringsewu" },
      { property: "og:description", content: "Lihat dokumentasi foto event dan kegiatan BRI Branch Office Pringsewu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EventDetailPage,
});

const fmt = (v: string | null) =>
  v ? new Date(v).toLocaleDateString("id-ID", { dateStyle: "medium" }) : "—";

function EventDetailPage() {
  const { id } = Route.useParams();
  const { from } = Route.useSearch();
  const backTo = from && from.startsWith("/") && !from.startsWith("//") ? from : "/";

  const event = useQuery({
    queryKey: ["public-event-detail", id],
    queryFn: async () => {
      const { data, error } = await db
        .from("events")
        .select("id,nama_event,deskripsi,tanggal_mulai")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as EventRow | null;
    },
  });

  return (
    <PublicLayout>
      <Link
        to={backTo as "/"}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Kembali
      </Link>

      {event.isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">Memuat event…</p>
      ) : event.isError ? (
        <p className="mt-8 text-sm text-destructive">Event tidak dapat dimuat.</p>
      ) : !event.data ? (
        <p className="mt-8 text-sm text-muted-foreground">Event tidak ditemukan.</p>
      ) : (
        <div className="mt-5 space-y-6">
          <section className="glass-card p-6 sm:p-8">
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarDays className="size-4" /> {fmt(event.data.tanggal_mulai)}
            </p>
            <h1 className="event-title-glow mt-3 text-2xl sm:text-3xl">{event.data.nama_event}</h1>
            {event.data.deskripsi ? (
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{event.data.deskripsi}</p>
            ) : null}
          </section>

          <section>
            <h2 className="mb-4 text-lg font-semibold">Foto Event</h2>
            <EventPhotoGrid
              eventId={event.data.id}
              publicAccess
              emptyText="Belum ada foto untuk event ini."
            />
          </section>
        </div>
      )}
    </PublicLayout>
  );
}