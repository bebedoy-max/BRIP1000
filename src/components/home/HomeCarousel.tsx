import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { getPublicEventPhotosByEvent } from "@/lib/public-events.functions";
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

    // Foto diambil per event lewat server (getPublicEventPhotosByEvent) supaya
    // setiap event pasti kebagian foto; kueri global dengan batas baris membuat
    // event lama kehabisan jatah dan tampil tanpa gambar.
    const byEvent = new Map<string, string[]>();
    if (evRows.length) {
      try {
        const perEvent = await getPublicEventPhotosByEvent({
          data: { eventIds: evRows.map((e) => e.id), perEvent: MAX_PHOTOS_PER_SLIDE },
        });
        for (const [id, list] of Object.entries(perEvent)) byEvent.set(id, list);
      } catch {
        /* abaikan; fallback kueri langsung di bawah */
      }
      const missing = evRows.filter((e) => !byEvent.get(e.id)?.length);
      if (missing.length) {
        const { data } = await db
          .from("event_photos")
          .select("event_id,drive_file_id,processed_at")
          .in(
            "event_id",
            missing.map((e) => e.id),
          )
          .order("processed_at", { ascending: false })
          .limit(400);
        const rows = (data ?? []) as { event_id: string; drive_file_id: string }[];
        for (const p of rows) {
          const list = byEvent.get(p.event_id) ?? [];
          list.push(p.drive_file_id);
          byEvent.set(p.event_id, list);
        }
      }
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

  // Semua konten yang dipilih admin tetap tampil; yang tanpa foto memakai
  // latar gradien agar jumlah slide sama dengan pengaturan carousel.
  const cleaned = slides.map((s) => ({
    ...s,
    photos: s.photos
      .filter((p) => typeof p === "string" && p.trim().length > 0)
      .slice(0, MAX_PHOTOS_PER_SLIDE),
  }));

  // Slide langsung dikembalikan; titik fokus diambil terpisah di latar
  // belakang (lihat useQuery "home-carousel-focus") karena analisis wajah di
  // server bisa memakan waktu puluhan detik — menunggunya membuat carousel
  // tampak kosong padahal datanya ada.
  return { slides: shuffle(cleaned), focus: {} as ImageFocusMap };
}

/** Kunci stabil dari daftar foto agar kueri fokus tidak berulang tanpa perlu. */
function focusKey(photos: string[]): string {
  return [...photos].sort().join("|");
}

/** Carousel utama dashboard: event, project IT, dan buku harian IT. */
export function HomeCarousel() {
  const q = useQuery({ queryKey: ["home-carousel"], queryFn: loadSlides, staleTime: 60_000 });
  const base = useMemo(() => q.data?.slides ?? [], [q.data]);

  // Fokus wajah dimuat setelah slide tampil; crop menyesuaikan saat data siap.
  const photosKey = focusKey(base.flatMap((s) => s.photos));
  const focusQ = useQuery({
    queryKey: ["home-carousel-focus", photosKey],
    enabled: photosKey.length > 0,
    staleTime: 300_000,
    queryFn: async (): Promise<ImageFocusMap> => {
      const images = photosKey
        .split("|")
        .filter(Boolean)
        .map((p) => ({ key: p, url: slideImageSrc(p, 1200) }));
      try {
        return await getImageFocus({ data: { images } });
      } catch {
        return {};
      }
    },
  });
  const focusMap = useMemo(() => focusQ.data ?? {}, [focusQ.data]);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [idx, setIdx] = useState(0);
  const idxRef = useRef(0);
  idxRef.current = idx;

  // Urutan diacak saat data siap.
  useEffect(() => {
    setSlides(shuffle(base));
    setIdx(0);
  }, [base]);

  // Otomatis berpindah slide; setiap putaran selesai urutan diacak ulang
  // supaya tampilan tidak monoton.
  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => {
      const next = idxRef.current + 1;
      if (next >= slides.length) {
        setSlides((s) => shuffle(s));
        setIdx(0);
      } else {
        setIdx(next);
      }
    }, 6000);
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

  // Gambar slide dimuat bertahap: hanya slide aktif dan tetangganya yang
  // memasang <img>. Memuat puluhan gambar Drive sekaligus membuat Google
  // membatasi permintaan sehingga banyak slide tampil tanpa gambar.
  const [mounted, setMounted] = useState<ReadonlySet<number>>(new Set([0]));
  useEffect(() => {
    if (!slides.length) return;
    setMounted((prev) => {
      const next = new Set(prev);
      next.add(idx);
      next.add((idx + 1) % slides.length);
      next.add((idx - 1 + slides.length) % slides.length);
      return next;
    });
  }, [idx, slides.length]);

  const active = slides[idx % (slides.length || 1)];
  const photoOf = (s: Slide) => photoBySlide[s.id] ?? null;

  const prev = () => setIdx((i) => (i - 1 + slides.length) % slides.length);
  const next = () => setIdx((i) => (i + 1) % slides.length);

  const navButton =
    "grid size-9 place-items-center rounded-full border border-border/70 bg-background/70 shadow-lg backdrop-blur transition-colors hover:border-primary/60";

  return (
    <div className="glass-card w-full overflow-hidden">
      {/* Area foto: di mobile tanpa teks di atas foto agar wajah tidak tertutup */}
      <div className="relative aspect-[4/3] w-full overflow-hidden sm:aspect-video">
        {slides.map((s, i) => {
          const photo = photoOf(s);
          return (
            <div
              key={s.id}
              className="absolute inset-0 transition-opacity duration-700"
              style={{ opacity: i === idx ? 1 : 0, pointerEvents: i === idx ? "auto" : "none" }}
            >
              {photo && mounted.has(i) ? (
                <SlideImage
                  photo={photo}
                  focus={focusMap[photo]}
                  alt={s.title}
                  className="absolute inset-0 size-full object-cover"
                />
              ) : !photo ? (
                <div
                  className="absolute inset-0"
                  style={{ backgroundImage: "var(--gradient-stat)", opacity: 0.35 }}
                />
              ) : null}
              <div className="absolute inset-0 hidden bg-gradient-to-t from-background/85 via-background/35 via-[25%] to-transparent to-[42%] sm:block" />
              <div className="absolute inset-0 hidden bg-gradient-to-r from-background/40 via-transparent to-transparent sm:block" />
              {/* Mobile: bayangan tipis hanya di tepi bawah foto untuk lencana */}
              <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/35 to-transparent sm:hidden" />
            </div>
          );
        })}

        {!slides.length ? (
          <div className="grid size-full place-items-center text-muted-foreground">
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

        {/* Mobile: lencana jenis + penghitung di sudut foto */}
        {active ? (
          <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex items-center justify-between sm:hidden">
            <span className="rounded-full bg-black/45 px-2.5 py-1 text-[10px] font-bold tracking-[0.14em] text-white uppercase backdrop-blur">
              {active.kind}
            </span>
            {slides.length > 1 ? (
              <span className="rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white tabular-nums backdrop-blur">
                {idx + 1}/{slides.length}
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Desktop/tablet: teks di atas foto seperti semula */}
        <div className="pointer-events-none absolute inset-0 z-20 hidden flex-col justify-end p-8 sm:flex">
          {active ? (
            <>
              <span
                className="w-fit rounded-full border border-primary/40 bg-background/70 px-3 py-1 text-[11px] font-semibold tracking-[0.18em] text-accent uppercase shadow-lg backdrop-blur"
                style={{ textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}
              >
                {active.kind}
              </span>
              <h2
                className="mt-3 max-w-2xl text-4xl leading-tight font-bold text-foreground"
                style={{
                  textShadow: "0 2px 4px rgba(0,0,0,0.7), 0 4px 14px rgba(0,0,0,0.5)",
                  WebkitTextStroke: "0.5px rgba(0,0,0,0.35)",
                }}
              >
                {active.title}
              </h2>
              <p
                className="mt-2 line-clamp-2 max-w-xl text-sm font-medium text-foreground/90"
                style={{ textShadow: "0 1px 3px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.5)" }}
              >
                {active.subtitle}
              </p>
              {active.to ? (
                <Link
                  to={active.to.to}
                  params={active.to.params}
                  search={{ from: "/" }}
                  className="pointer-events-auto mt-4 w-fit rounded-xl border border-border/70 bg-background/70 px-4 py-2 text-sm font-medium shadow-lg backdrop-blur transition-colors hover:border-primary/60 hover:text-foreground"
                >
                  Lihat detail
                </Link>
              ) : null}
            </>
          ) : null}

          {slides.length > 1 ? (
            <div className="pointer-events-auto mt-5 flex items-center gap-2">
              <button type="button" aria-label="Sebelumnya" onClick={prev} className={navButton}>
                <ChevronLeft className="size-4" />
              </button>
              <button type="button" aria-label="Berikutnya" onClick={next} className={navButton}>
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

      {/* Mobile: judul & kontrol di bawah foto */}
      {active ? (
        <div className="space-y-3 p-4 sm:hidden">
          <div className="min-w-0">
            <h2 className="line-clamp-2 text-[17px] leading-snug font-bold">{active.title}</h2>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{active.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            {active.to ? (
              <Link
                to={active.to.to}
                params={active.to.params}
                search={{ from: "/" }}
                className="flex h-10 flex-1 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
              >
                Lihat detail
              </Link>
            ) : (
              <span className="flex-1" />
            )}
            {slides.length > 1 ? (
              <>
                <button type="button" aria-label="Sebelumnya" onClick={prev} className={navButton}>
                  <ChevronLeft className="size-4" />
                </button>
                <button type="button" aria-label="Berikutnya" onClick={next} className={navButton}>
                  <ChevronRight className="size-4" />
                </button>
              </>
            ) : null}
          </div>
          {slides.length > 1 ? (
            <div
              className="h-1 w-full overflow-hidden rounded-full bg-border/60"
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={slides.length}
              aria-valuenow={idx + 1}
            >
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${((idx + 1) / slides.length) * 100}%` }}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
