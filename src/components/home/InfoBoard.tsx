import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, MonitorPlay } from "lucide-react";

import {
  embedVideoSrc,
  infoMediaSrc,
  isEmbedVideo,
  loadInfoSlides,
  type InfoSlide,
} from "@/lib/info-board";

const enterClass: Record<string, string> = {
  fade: "animate-info-fade",
  slide: "animate-info-slide",
  zoom: "animate-info-zoom",
  flip: "animate-info-flip",
  none: "",
};

/** Papan informasi digital BRI KC Pringsewu (teks / gambar / video). */
export function InfoBoard() {
  const q = useQuery({
    queryKey: ["info-board-slides"],
    queryFn: loadInfoSlides,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
  const slides = useMemo<InfoSlide[]>(() => q.data ?? [], [q.data]);
  const [idx, setIdx] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (idx >= slides.length) setIdx(0);
  }, [slides.length, idx]);

  const current = slides[idx];
  const next = () => setIdx((i) => (slides.length ? (i + 1) % slides.length : 0));
  const prev = () => setIdx((i) => (slides.length ? (i - 1 + slides.length) % slides.length : 0));

  // Teks & gambar berganti sesuai durasi; video (file) berganti saat selesai.
  const isFileVideo = current?.jenis === "video" && !!current.media_url && !isEmbedVideo(current.media_url);
  useEffect(() => {
    if (!current || slides.length < 2 || isFileVideo) return;
    const ms = Math.max(2, Number(current.durasi) || 8) * 1000;
    const t = setTimeout(() => setIdx((i) => (i + 1) % slides.length), ms);
    return () => clearTimeout(t);
  }, [current, slides.length, isFileVideo]);

  if (q.isLoading)
    return (
      <div className="glass-card p-5 text-sm text-muted-foreground">Memuat papan informasi…</div>
    );
  if (!slides.length || !current) return null;

  const anim = enterClass[current.transisi] ?? "animate-info-fade";

  return (
    <section className="glass-card overflow-hidden p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-accent uppercase">
          <MonitorPlay className="size-4" /> Papan Informasi
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Slide sebelumnya"
            onClick={prev}
            className="rounded-full border border-border/60 p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="text-[11px] text-muted-foreground">
            {idx + 1}/{slides.length}
          </span>
          <button
            type="button"
            aria-label="Slide berikutnya"
            onClick={next}
            className="rounded-full border border-border/60 p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div key={current.id} className={`mt-3 ${anim}`}>
        <h3 className="text-base font-semibold">{current.judul}</h3>

        {current.jenis === "image" && current.media_url ? (
          <img
            src={infoMediaSrc(current.media_url)}
            alt={current.judul}
            className="mt-3 max-h-[320px] w-full rounded-xl object-cover"
            loading="lazy"
          />
        ) : null}

        {current.jenis === "video" && current.media_url ? (
          isEmbedVideo(current.media_url) ? (
            <iframe
              key={current.media_url}
              src={embedVideoSrc(current.media_url)}
              title={current.judul}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              className="mt-3 aspect-video w-full rounded-xl border-0"
            />
          ) : (
            <video
              ref={videoRef}
              key={current.media_url}
              src={infoMediaSrc(current.media_url)}
              autoPlay
              muted
              playsInline
              controls
              onEnded={next}
              onError={next}
              className="mt-3 max-h-[320px] w-full rounded-xl bg-black object-contain"
            />
          )
        ) : null}

        {current.isi ? (
          <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
            {current.isi}
          </p>
        ) : null}
      </div>

      <div className="mt-4 flex gap-1">
        {slides.map((s, i) => (
          <button
            key={s.id}
            type="button"
            aria-label={`Slide ${i + 1}`}
            onClick={() => setIdx(i)}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i === idx ? "bg-accent" : "bg-border/60"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
