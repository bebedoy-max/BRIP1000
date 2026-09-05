import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { slideImageSrc } from "@/lib/carousel";

const db = supabase as unknown as SupabaseClient;

/** Jenis konten papan informasi. */
export const infoKinds = [
  { value: "text", label: "Teks" },
  { value: "image", label: "Gambar" },
  { value: "video", label: "Video" },
] as const;

export type InfoKind = (typeof infoKinds)[number]["value"];

/** Efek transisi perpindahan slide. */
export const infoTransitions = [
  { value: "fade", label: "Fade (memudar)" },
  { value: "slide", label: "Slide (geser)" },
  { value: "zoom", label: "Zoom" },
  { value: "flip", label: "Flip" },
  { value: "none", label: "Tanpa efek" },
] as const;

export type InfoTransition = (typeof infoTransitions)[number]["value"];

export type InfoSlide = {
  id: string;
  judul: string;
  jenis: InfoKind;
  isi: string | null;
  media_url: string | null;
  durasi: number;
  transisi: InfoTransition;
  aktif: boolean;
  urutan: number;
};

/** Slide untuk halaman admin (semua, termasuk yang nonaktif). */
export async function loadInfoSlidesAll(): Promise<InfoSlide[]> {
  try {
    const { data, error } = await db
      .from("info_board_slides")
      .select("id,judul,jenis,isi,media_url,durasi,transisi,aktif,urutan")
      .order("urutan", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) return [];
    return (data ?? []) as InfoSlide[];
  } catch {
    return [];
  }
}

/** Slide aktif untuk papan informasi di dashboard. */
export async function loadInfoSlides(): Promise<InfoSlide[]> {
  return (await loadInfoSlidesAll()).filter((s) => s.aktif);
}

/** Apakah URL merupakan tautan YouTube / Vimeo (dipasang lewat iframe). */
export function isEmbedVideo(url: string) {
  return /youtu\.be|youtube\.com|vimeo\.com/i.test(url);
}

/** URL embed untuk video YouTube/Vimeo (autoplay, tanpa suara). */
export function embedVideoSrc(url: string) {
  const yt = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?autoplay=1&mute=1&controls=0&rel=0&playsinline=1`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}?autoplay=1&muted=1`;
  return url;
}

/** Sumber media slide (URL langsung atau ID file Google Drive). */
export function infoMediaSrc(value: string, size = 1200) {
  return slideImageSrc(value, size);
}
