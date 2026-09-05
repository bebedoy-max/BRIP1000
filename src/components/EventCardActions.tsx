import { useEffect, useState } from "react";
import { Facebook, Heart, Instagram, Link2, Share2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toggleEventLike } from "@/lib/event-likes.functions";

const VISITOR_KEY = "superit_visitor_id";
const LIKED_KEY = "superit_liked_events";

function visitorId() {
  if (typeof window === "undefined") return "";
  let v = window.localStorage.getItem(VISITOR_KEY);
  if (!v) {
    v = (window.crypto?.randomUUID?.() ?? `v-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    window.localStorage.setItem(VISITOR_KEY, v);
  }
  return v;
}

function readLiked(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(LIKED_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeLiked(ids: string[]) {
  window.localStorage.setItem(LIKED_KEY, JSON.stringify(ids));
}

const XIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M18.9 2H22l-7.1 8.1L23.2 22h-6.6l-5.2-6.8L5.5 22H2.3l7.6-8.7L1.1 2h6.8l4.7 6.2L18.9 2Zm-1.2 18h1.8L7.4 3.9H5.5L17.7 20Z" />
  </svg>
);

const TikTokIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M16.5 2h-2.9v13.2a2.7 2.7 0 1 1-2.2-2.7v-3a5.7 5.7 0 1 0 5.1 5.7V9.1a6.6 6.6 0 0 0 3.9 1.3V7.5a3.8 3.8 0 0 1-3.9-3.7V2Z" />
  </svg>
);

/** Tombol like & share pada kartu event. Diletakkan di dalam kartu yang berupa link. */
export function EventCardActions({
  eventId,
  eventName,
  likes,
  onLiked,
}: {
  eventId: string;
  eventName: string;
  likes: number;
  onLiked?: (likes: number, liked: boolean) => void;
}) {
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(likes);
  const [busy, setBusy] = useState(false);

  useEffect(() => setCount(likes), [likes]);
  useEffect(() => setLiked(readLiked().includes(eventId)), [eventId]);

  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/event/${eventId}` : `/event/${eventId}`;
  const shareText = `Foto & dokumentasi event ${eventName} — BRI BO Pringsewu`;

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleLike = async (e: React.MouseEvent) => {
    stop(e);
    if (busy) return;
    setBusy(true);
    const nextLiked = !liked;
    setLiked(nextLiked);
    setCount((c) => Math.max(0, c + (nextLiked ? 1 : -1)));
    const ids = readLiked().filter((id) => id !== eventId);
    writeLiked(nextLiked ? [...ids, eventId] : ids);
    try {
      const res = await toggleEventLike({ data: { eventId, visitorId: visitorId() } });
      setLiked(res.liked);
      setCount(res.likes);
      onLiked?.(res.likes, res.liked);
    } catch {
      // Tetap simpan status lokal bila server belum siap.
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async (e: React.MouseEvent) => {
    stop(e);
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link event disalin.");
    } catch {
      toast.error("Gagal menyalin link.");
    }
  };

  const openShare = (e: React.MouseEvent, url: string, copyFirst?: boolean) => {
    stop(e);
    if (copyFirst) {
      void navigator.clipboard
        ?.writeText(`${shareText}\n${shareUrl}`)
        .then(() => toast.success("Link disalin — tempel di caption unggahan Anda."))
        .catch(() => undefined);
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const btn =
    "inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-xs text-muted-foreground backdrop-blur transition-colors hover:border-primary/50 hover:text-foreground";

  return (
    <div className="mt-3 flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={handleLike}
        aria-pressed={liked}
        aria-label={liked ? `Batalkan suka event ${eventName}` : `Sukai event ${eventName}`}
        className={btn}
      >
        <Heart className={`size-3.5 ${liked ? "fill-current text-primary" : ""}`} />
        {count}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onClick={stop}
            aria-label={`Bagikan event ${eventName}`}
            className={btn}
          >
            <Share2 className="size-3.5" /> Bagikan
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem
            onClick={(e) =>
              openShare(
                e as unknown as React.MouseEvent,
                `https://www.instagram.com/`,
                true,
              )
            }
          >
            <Instagram className="size-4" /> Instagram
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) =>
              openShare(
                e as unknown as React.MouseEvent,
                `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
              )
            }
          >
            <Facebook className="size-4" /> Facebook
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) =>
              openShare(e as unknown as React.MouseEvent, `https://www.tiktok.com/upload`, true)
            }
          >
            <TikTokIcon className="size-4" /> TikTok
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) =>
              openShare(
                e as unknown as React.MouseEvent,
                `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
              )
            }
          >
            <XIcon className="size-4" /> X (Twitter)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={(e) => copyLink(e as unknown as React.MouseEvent)}>
            <Link2 className="size-4" /> Salin link
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
