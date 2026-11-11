import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";

const ctl =
  "absolute grid size-11 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-all " +
  "opacity-50 md:opacity-0 md:group-hover/stage:opacity-40 hover:bg-black/75 hover:opacity-100! focus-visible:opacity-100! focus-visible:outline-none";

/**
 * Penampil foto: tombol sebelumnya/berikutnya semi-transparan di tepi kiri-kanan dan tombol
 * layar penuh di pojok kanan bawah. Tombol memudar saat tidak di-hover dan menjadi tegas saat disentuh.
 * Di HP (tanpa hover) tombol selalu terlihat samar. Panah keyboard kiri/kanan juga berfungsi.
 */
export function PhotoStage({
  src,
  alt,
  onPrev,
  onNext,
  imgClassName = "max-h-[70vh] w-full object-contain",
}: {
  src: string;
  alt: string;
  onPrev?: (() => void) | undefined;
  onNext?: (() => void) | undefined;
  imgClassName?: string;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [native, setNative] = useState(false);
  const [css, setCss] = useState(false);
  const full = native || css;

  useEffect(() => {
    const onChange = () => setNative(document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowLeft") onPrev?.();
      else if (e.key === "ArrowRight") onNext?.();
      else if (e.key === "Escape" && css) {
        e.stopPropagation();
        setCss(false);
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onPrev, onNext, css]);

  // Keluar dari layar penuh saat penampil ditutup.
  useEffect(
    () => () => {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    },
    [],
  );

  async function toggleFull() {
    const el = stageRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
      return;
    }
    if (css) {
      setCss(false);
      return;
    }
    if (el.requestFullscreen) {
      try {
        await el.requestFullscreen();
        return;
      } catch {
        /* lanjut ke mode layar penuh CSS */
      }
    }
    setCss(true);
  }

  return (
    <div
      ref={stageRef}
      className={`group/stage relative flex items-center justify-center overflow-hidden ${
        css ? "fixed inset-0 z-[200] bg-black" : native ? "bg-black" : "rounded-xl"
      }`}
    >
      <img
        src={src}
        alt={alt}
        className={full ? "h-full w-full object-contain" : imgClassName}
        draggable={false}
      />

      {onPrev ? (
        <button
          type="button"
          aria-label="Foto sebelumnya"
          onClick={onPrev}
          className={`${ctl} top-1/2 left-3 -translate-y-1/2`}
        >
          <ChevronLeft className="size-6" />
        </button>
      ) : null}
      {onNext ? (
        <button
          type="button"
          aria-label="Foto berikutnya"
          onClick={onNext}
          className={`${ctl} top-1/2 right-3 -translate-y-1/2`}
        >
          <ChevronRight className="size-6" />
        </button>
      ) : null}

      <button
        type="button"
        aria-label={full ? "Keluar layar penuh" : "Tampilkan layar penuh"}
        onClick={() => void toggleFull()}
        className={`${ctl} right-3 bottom-3 size-10`}
      >
        {full ? <Minimize2 className="size-5" /> : <Maximize2 className="size-5" />}
      </button>
    </div>
  );
}
