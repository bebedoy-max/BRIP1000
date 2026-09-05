import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { getPublicEventPhotos } from "@/lib/public-events.functions";
import { loadDiaryPhotos } from "@/components/DiarySummary";
import { loadCarouselConfig, shuffle, slideImageSrc, slideImageSources } from "@/lib/carousel";
import { getImageFocus, type ImageFocusMap } from "@/lib/image-focus.functions";
import { SmartCoverImage } from "@/components/SmartCoverImage";

const db = supabase as unknown as SupabaseClient;

/** Gambar slide dengan fallback: URL utama → URL alternatif Drive → placeholder. */
function SlideImage({
  photo,
  focus,
  alt,
  className,
}: {
  photo: string;
  focus: ImageFocusMap[string] | undefined;
  alt: string;
  className?: string;
}) {
  const [attempt, setAttempt] = useState(0);
  useEffect(() => setAttempt(0), [photo]);

  const sources = slideImageSources(photo, 1200);
  const src = sources[attempt] ?? null;

  if (!src) {
    return (
      <div
        className="absolute inset-0"
        style={{ backgroundImage: "var(--gradient-stat)", opacity: 0.35 }}
      />
    );
  }
  return (
    <SmartCoverImage
      src={src}
      focus={focus}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setAttempt((a) => a + 1)}
    />
  );
}

type Slide = {
  id: string;
  kind: "Event" | "Project IT" | "Buku Harian IT";
  title: string;
  subtitle: string;
  photos: string[];
  to?: { to: string; params: Record<string, string> };
};

type CarouselData = { slides: Slide[]; focus: ImageFocusMap };

/** Maksimal foto per slide yang ikut dianalisis wajahnya di server. */
const MAX_PHOTOS_PER_SLIDE = 3;

async function loadSlides(): Promise<CarouselData> {
  const config = await loadCarouselConfig();
  const conf = (key: string) => config.find((c) => c.sumber === key);
  const slides: Slide[] = [];

  const evConf = conf("event");
  if (evConf?.aktif) {
    let evQuery = db
      .from("events")
      .select("id,nama_event,tanggal_mulai")
      .order("tanggal_mulai", { ascending: false, nullsFirst: false });
    if (evConf.item_ids.length) evQuery = evQuery.in("id", evConf.item_ids);
    else evQuery = evQuery.limit(evConf.jumlah);
    const { data: events } = await evQuery;
    const evRows = (events ?? []) as {
      id: string;
      nama_event: string;
      tanggal_mulai: string | null;
    }[];

    let photos: { event_id: string; drive_file_id: string }[] = [];
    if (evRows.length) {
      const { data } = await db
        .from("event_photos")
        .select("event_id,drive_file_id,processed_at")
        .in("event_id", evRows.map((e) => e.id))
        .order("processed_at", { ascending: false })
        .limit(400);
      photos = (data ?? []) as typeof photos;
      // Sebagian event bisa saja tidak terbaca lewat RLS; lengkapi dari sumber publik.
      const covered = new Set(photos.map((p) => p.event_id));
      if (evRows.some((e) => !covered.has(e.id))) {
        try {
          const extra = await getPublicEventPhotos();
          photos = [...photos, ...extra.filter((p) => !covered.has(p.event_id))];
        } catch {
          /* abaikan */
        }
      }
    }
    const byEvent = new Map<string, string[]>();
    for (const p of photos) {
      const list = byEvent.get(p.event_id) ?? [];
      list.push(p.drive_file_id);
      byEvent.set(p.event_id, list);
    }
    for (const e of evRows) {
      slides.push({
        id: `event-${e.id}`,
        kind: "Event",
        title: e.nama_event,
        subtitle: e.tanggal_mulai
          ? new Date(e.tanggal_mulai).toLocaleDateString("id-ID", { dateStyle: "long" })
          : "Kegiatan kantor",
        photos: byEvent.get(e.id) ?? [],
        to: { to: "/event/$id", params: { id: e.id } },
      });
    }
  }

  const prConf = conf("project");
  if (prConf?.aktif) {
    let prQuery = db
      .from("projects")
      .select("id,nama_project,deskripsi,deadline,foto_url")
      .order("created_at", { ascending: false });
    if (prConf.item_ids.length) prQuery = prQuery.in("id", prConf.item_ids);
    else prQuery = prQuery.limit(prConf.jumlah);
    const { data: projects } = await prQuery;
    for (const p of (projects ?? []) as {
      id: string;
      nama_project: string;
      deskripsi: string | null;
      deadline: string | null;
      foto_url?: string | null;
    }[]) {
      slides.push({
        id: `project-${p.id}`,
        kind: "Project IT",
        title: p.nama_project,
        subtitle:
          p.deskripsi ||
          (p.deadline
            ? `Deadline ${new Date(p.deadline).toLocaleDateString("id-ID", { dateStyle: "long" })}`
            : "Project berjalan"),
        photos: p.foto_url ? [p.foto_url] : [],
        to: { to: "/project/$id", params: { id: p.id } },
      });
    }
  }

  const dConf = conf("diary");
  if (dConf?.aktif) {
    let dQuery = db
      .from("it_diary_logs")
      .select("id,nama_kegiatan,status,tanggal")
      .order("tanggal", { ascending: false });
    if (dConf.item_ids.length) dQuery = dQuery.in("id", dConf.item_ids);
    else dQuery = dQuery.limit(dConf.jumlah);
    const { data: diary } = await dQuery;
    const dRows = (diary ?? []) as {
      id: string;
      nama_kegiatan: string;
      status: string;
      tanggal: string;
    }[];
    const dPhotos = await loadDiaryPhotos(dRows.map((r) => r.id)).catch(
      () => ({}) as Record<string, string[]>,
    );
    for (const d of dRows) {
      slides.push({
        id: `diary-${d.id}`,
        kind: "Buku Harian IT",
        title: d.nama_kegiatan,
        subtitle: `${d.status} · ${new Date(`${d.tanggal}T00:00:00`).toLocaleDateString("id-ID", { dateStyle: "long" })}`,
        photos: dPhotos[d.id] ?? [],
      });
    }
  }

  const withPhotos = slides
    .map((s) => ({
      ...s,
      photos: s.photos.filter((p) => typeof p === "string" && p.trim().length > 0),
    }))
    // Slide tanpa foto tidak ditampilkan agar carousel tidak pernah kosong gambar.
    .filter((s) => s.photos.length > 0);

  const ordered = shuffle(withPhotos).map((s) => ({
    ...s,
    photos: s.photos.slice(0, MAX_PHOTOS_PER_SLIDE),
  }));

  // Titik fokus dihitung di server sebelum gambar dirender, jadi crop tidak
  // berubah setelah gambar tampil.
  const images = Array.from(
    new Map(
      ordered
        .flatMap((s) => s.photos)
        .map((p) => [p, { key: p, url: slideImageSrc(p, 1200) }] as const),
    ).values(),
  );
  let focus: ImageFocusMap = {};
  try {
    focus = await getImageFocus({ data: { images } });
  } catch {
    focus = {};
  }

  return { slides: ordered, focus };
}

/** Carousel utama dashboard: event, project IT, dan buku harian IT. */
export function HomeCarousel() {
  const q = useQuery({ queryKey: ["home-carousel"], queryFn: loadSlides, staleTime: 60_000 });
  const slides = useMemo(() => q.data?.slides ?? [], [q.data]);
  const focusMap = useMemo(() => q.data?.focus ?? {}, [q.data]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, [slides.length]);

  // Foto per slide dipilih sekali (stabil) supaya gambar tidak berganti di
  // tengah transisi. Foto dengan wajah terdeteksi diutamakan.
  const photoBySlide = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const s of slides) {
      if (!s.photos.length) {
        map[s.id] = null;
        continue;
      }
      const withFace = s.photos.filter((p) => focusMap[p]?.face);
      const pool = withFace.length ? withFace : s.photos;
      map[s.id] = pool[Math.floor(Math.random() * pool.length) % pool.length]!;
    }
    return map;
  }, [slides, focusMap]);

  const active = slides[idx % (slides.length || 1)];
  const photoOf = (s: Slide) => photoBySlide[s.id] ?? null;

  return (
    <div className="glass-card relative h-[8cm] min-h-[8cm] lg:h-[14cm] lg:min-h-[14cm] overflow-hidden">
      {slides.map((s, i) => {
        const photo = photoOf(s);
        return (
        <div
          key={s.id}
          className="absolute inset-0 transition-opacity duration-700"
          style={{ opacity: i === idx ? 1 : 0, pointerEvents: i === idx ? "auto" : "none" }}
        >
          {photo ? (
            <SlideImage
              photo={photo}
              focus={focusMap[photo]}
              alt={s.title}
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{ backgroundImage: "var(--gradient-stat)", opacity: 0.35 }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/10" />
        </div>
        );
      })}

      {!slides.length ? (
        <div className="grid h-full min-h-[8cm] lg:min-h-[14cm] place-items-center text-muted-foreground">
          <ImageOff className="size-6" />
        </div>
      ) : null}

      {active?.to ? (
        <Link
          to={active.to.to}
          params={active.to.params}
          search={{ from: "/" }}
          aria-label={`Buka ${active.title}`}
          className="absolute inset-0 z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        />
      ) : null}

      <div className="pointer-events-none relative z-20 flex h-full min-h-[8cm] lg:min-h-[14cm] flex-col justify-end p-6 sm:p-8">
        {active ? (
          <>
            <span className="w-fit rounded-full border border-primary/40 bg-background/60 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-accent uppercase backdrop-blur">
              {active.kind}
            </span>
            <h2 className="mt-3 max-w-2xl text-2xl leading-tight font-bold sm:text-4xl">
              <span className="gradient-text">{active.title}</span>
            </h2>
            <p className="mt-2 line-clamp-2 max-w-xl text-sm text-muted-foreground">
              {active.subtitle}
            </p>
            {active.to ? (
              <Link
                to={active.to.to}
                params={active.to.params}
                search={{ from: "/" }}
                className="pointer-events-auto mt-4 w-fit rounded-xl border border-border/70 bg-background/60 px-4 py-2 text-sm font-medium backdrop-blur transition-colors hover:border-primary/60 hover:text-foreground"
              >
                Lihat detail
              </Link>
            ) : null}
          </>
        ) : null}

        {slides.length > 1 ? (
          <div className="pointer-events-auto mt-5 flex items-center gap-2">
            <button
              type="button"
              aria-label="Sebelumnya"
              onClick={() => setIdx((i) => (i - 1 + slides.length) % slides.length)}
              className="grid size-8 place-items-center rounded-full border border-border/70 bg-background/60 backdrop-blur transition-colors hover:border-primary/60"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Berikutnya"
              onClick={() => setIdx((i) => (i + 1) % slides.length)}
              className="grid size-8 place-items-center rounded-full border border-border/70 bg-background/60 backdrop-blur transition-colors hover:border-primary/60"
            >
              <ChevronRight className="size-4" />
            </button>
            <div className="ml-2 flex flex-wrap gap-1.5">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  aria-label={`Slide ${i + 1}`}
                  onClick={() => setIdx(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === idx ? "w-6 bg-primary" : "w-2 bg-border"
                  }`}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
