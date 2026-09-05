import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, Info, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/face";
import { EventPhotoGrid } from "@/components/EventPhotoGrid";
import { DatePickerField } from "@/components/DatePickerField";

type EventRow = {
  id: string;
  nama_event: string;
  deskripsi: string | null;
  tanggal_mulai: string | null;
  drive_folder_id: string | null;
};

const fmt = (v: string | null) =>
  v ? new Date(v).toLocaleDateString("id-ID", { dateStyle: "medium" }) : "—";

/**
 * Menu Event (read-only). Upload foto dilakukan dari companion app SuperIT,
 * web app hanya menampilkan galeri hasil prosesnya.
 */
export function EventGalleryBrowser() {
  const [q, setQ] = useState("");
  const [date, setDate] = useState("");
  const [selected, setSelected] = useState<EventRow | null>(null);

  const events = useQuery({
    queryKey: ["event-gallery-events"],
    queryFn: async () => {
      const { data, error } = await db
        .from("events")
        .select("id,nama_event,deskripsi,tanggal_mulai,drive_folder_id")
        .order("tanggal_mulai", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as EventRow[];
    },
  });

  const counts = useQuery({
    queryKey: ["event-gallery-counts"],
    queryFn: async () => {
      const { data, error } = await db.from("event_photos").select("event_id");
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const r of (data ?? []) as { event_id: string }[]) {
        map[r.event_id] = (map[r.event_id] ?? 0) + 1;
      }
      return map;
    },
  });

  if (selected) {
    return (
      <div className="space-y-5">
        <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
          <ArrowLeft className="size-4" /> Kembali ke daftar event
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{selected.nama_event}</h1>
          <p className="text-sm text-muted-foreground">
            {fmt(selected.tanggal_mulai)}
            {selected.deskripsi ? ` — ${selected.deskripsi}` : ""}
          </p>
        </div>
        <EventPhotoGrid
          eventId={selected.id}
          emptyText="Belum ada foto untuk event ini. Foto akan muncul setelah diproses lewat companion app."
        />
      </div>
    );
  }

  const rows = (events.data ?? []).filter((e) => {
    const okQ = q.trim()
      ? `${e.nama_event} ${e.deskripsi ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())
      : true;
    const okDate = date ? (e.tanggal_mulai ?? "").slice(0, 10) === date : true;
    return okQ && okDate;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Event</h1>
          <p className="text-sm text-muted-foreground">
            Galeri dokumentasi event hasil proses face recognition.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari event…"
              className="w-56 pl-9"
            />
          </div>
          <DatePickerField
            value={date}
            onChange={setDate}
            className="w-44"
            placeholder="Filter tanggal"
          />
        </div>
      </div>

      <div className="glass-card flex items-start gap-3 p-4 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          Unggah dan pemrosesan foto event kini dilakukan lewat aplikasi companion SuperIT (lihat
          menu <strong>Apps Ext</strong>). Halaman ini hanya menampilkan hasilnya.
        </p>
      </div>

      {events.isLoading ? (
        <p className="text-sm text-muted-foreground">Memuat event…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Tidak ada event yang cocok.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => setSelected(e)}
              className="glass-card p-4 text-left transition-colors hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <p className="font-semibold">{e.nama_event}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <CalendarDays className="size-3.5" /> {fmt(e.tanggal_mulai)}
              </p>
              {e.deskripsi ? (
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{e.deskripsi}</p>
              ) : null}
              <p className="mt-3 text-xs text-muted-foreground">
                {counts.data?.[e.id] ?? 0} foto
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
