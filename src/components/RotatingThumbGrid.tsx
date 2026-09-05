import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { driveThumb } from "@/lib/face";

/** Thumbnail yang berganti-ganti secara acak dari koleksi foto dengan crossfade. */
export function RotatingThumb({
  ids,
  alt,
  delay,
  className,
}: {
  ids: string[];
  alt: string;
  delay: number;
  className?: string;
}) {
  const [current, setCurrent] = useState(0);
  const [next, setNext] = useState(0);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    if (ids.length < 2) return;
    const t = setInterval(() => {
      const n = ids.length;
      const newIdx = (current + 1 + Math.floor(Math.random() * (n - 1))) % n;
      setNext(newIdx);
      setTransitioning(true);
      const commit = setTimeout(() => {
        setCurrent(newIdx);
        setTransitioning(false);
      }, 3000);
      return () => clearTimeout(commit);
    }, 8000 + delay);
    return () => clearInterval(t);
  }, [ids, delay, current]);

  const box = className ?? "aspect-square w-full";

  if (!ids.length)
    return (
      <div className={`grid place-items-center bg-secondary/60 text-muted-foreground ${box}`}>
        <ImageOff className="size-4" />
      </div>
    );

  const currentId = ids[current] ?? ids[0];
  const nextId = ids[next] ?? currentId;
  if (!currentId) return null;
  const nextSrc = nextId ? driveThumb(nextId) : driveThumb(currentId);

  return (
    <div className={`relative overflow-hidden ${box}`}>
      <img
        src={driveThumb(currentId)}
        alt={alt}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover transition-opacity duration-[3000ms] ease-in-out"
        style={{ opacity: transitioning ? 0 : 1 }}
      />
      <img
        src={nextSrc}
        alt={alt}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover transition-opacity duration-[3000ms] ease-in-out"
        style={{ opacity: transitioning ? 1 : 0 }}
      />
    </div>
  );
}

/** Grid 4 thumbnail acak dengan efek crossfade seperti kartu foto event. */
export function RotatingThumbGrid({
  photos,
  alt,
  className = "",
}: {
  photos: string[];
  alt: string;
  className?: string;
}) {
  const slots = Math.min(4, Math.max(1, photos.length || 1));
  return (
    <div
      className={`grid gap-1 overflow-hidden rounded-xl border border-border/60 ${
        slots > 1 ? "grid-cols-2" : "grid-cols-1"
      } ${className}`}
    >
      {Array.from({ length: slots }, (_, slot) => (
        <RotatingThumb
          key={slot}
          ids={photos.filter((_, i) => i % slots === slot)}
          alt={alt}
          delay={slot * 700}
        />
      ))}
    </div>
  );
}
