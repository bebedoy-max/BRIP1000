import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, UserRound } from "lucide-react";
import { loadWorkerSlides } from "@/lib/worker-slider";

/** Durasi transisi fade out + fade in total 5 detik (2.5s masing-masing). */
const FADE_MS = 2500;
/** Durasi tampil per slide (belum termasuk transisi). */
const DISPLAY_MS = 10_000;

/** Kolom slide profil pekerja (di bawah infografis). */
export function WorkerSlider() {
  const q = useQuery({
    queryKey: ["worker-slides"],
    queryFn: loadWorkerSlides,
    staleTime: 60_000,
  });
  const slides = q.data ?? [];
  const [displayed, setDisplayed] = useState(0);
  // `fading` true = sedang fade out (opacity 1 -> 0), false = fade in (0 -> 1).
  const [fading, setFading] = useState(false);
  const lockRef = useRef(false);

  const displayedRef = useRef(0);
  const advance = useCallback(
    (next: number) => {
      if (lockRef.current) return;
      lockRef.current = true;
      setFading(true);
      window.setTimeout(() => {
        displayedRef.current = next;
        setDisplayed(next);
        setFading(false);
        window.setTimeout(() => {
          lockRef.current = false;
        }, FADE_MS);
      }, FADE_MS);
    },
    [],
  );

  const goNext = useCallback(() => {
    advance((displayedRef.current + 1) % slides.length);
  }, [advance, slides.length]);

  const goPrev = useCallback(() => {
    advance((displayedRef.current - 1 + slides.length) % slides.length);
  }, [advance, slides.length]);

  useEffect(() => {
    if (slides.length < 2) return;
    const t = window.setInterval(goNext, DISPLAY_MS + FADE_MS * 2);
    return () => clearInterval(t);
  }, [slides.length, goNext]);

  if (!slides.length) return null;
  const s = slides[displayed % slides.length]!;

  return (
    <section className="glass-card relative overflow-hidden p-3.5">
      <div
        style={{
          opacity: fading ? 0 : 1,
          transition: `opacity ${FADE_MS}ms ease-in-out`,
        }}
      >
        <h2 className="text-center text-base leading-tight font-extrabold tracking-tight">
          {s.nama}
        </h2>

        <div
          className="mt-3 overflow-hidden rounded-xl border border-border/60 bg-muted"
          style={
            s.glow
              ? ({
                  "--glow": s.glow,
                  borderColor: s.glow,
                  animation: "worker-glow-pulse 2.4s ease-in-out infinite",
                } as React.CSSProperties)
              : undefined
          }
        >
          {s.photo ? (
            <img
              src={s.photo}
              alt={`Foto ${s.nama}`}
              loading="lazy"
              className="block aspect-[3/4] w-full object-cover object-top"
            />
          ) : (
            <div className="grid aspect-[3/4] w-full place-items-center text-muted-foreground">
              <UserRound className="size-10" />
            </div>
          )}
        </div>

        <div className="mt-3 space-y-1 text-sm">
          <p className="font-medium">{s.jabatan || "—"}</p>
          <p className="text-muted-foreground">{s.uker || "—"}</p>
        </div>
      </div>

      {slides.length > 1 ? (
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            aria-label="Pekerja sebelumnya"
            onClick={goPrev}
            className="grid size-7 place-items-center rounded-full border border-border/70 bg-background/60 transition-colors hover:border-primary/60"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Pekerja berikutnya"
            onClick={goNext}
            className="grid size-7 place-items-center rounded-full border border-border/70 bg-background/60 transition-colors hover:border-primary/60"
          >
            <ChevronRight className="size-3.5" />
          </button>
          <div className="ml-1 flex flex-wrap gap-1.5">
            {slides.map((w, i) => (
              <button
                key={w.id}
                type="button"
                aria-label={`Slide ${i + 1}`}
                onClick={() => advance(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === displayed ? "w-5 bg-primary" : "w-2 bg-border"
                }`}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
