import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

const db = supabase as unknown as SupabaseClient;

/**
 * Pengaturan tampilan global (tema warna + font).
 *
 * Tema diterapkan sebagai atribut `data-theme` dan font sebagai `data-font`
 * pada elemen <html>. Seluruh warna aplikasi memakai token semantik yang
 * diturunkan dari variabel tema, sehingga menu/halaman baru di masa depan
 * otomatis ikut berubah saat Super Admin mengganti tema.
 */
export type ThemePreset = {
  key: string;
  label: string;
  description: string;
  /** Warna contoh untuk pratinjau kartu tema. */
  swatch: string[];
};

export const themePresets: ThemePreset[] = [
  {
    key: "biru",
    label: "Biru Korporat",
    description: "Tema bawaan, biru BRI dengan aksen langit.",
    swatch: ["oklch(0.58 0.13 250)", "oklch(0.7 0.09 226)", "oklch(0.24 0.03 250)"],
  },
  {
    key: "zamrud",
    label: "Hijau Zamrud",
    description: "Nuansa hijau segar, cocok untuk tampilan siang.",
    swatch: ["oklch(0.58 0.13 168)", "oklch(0.7 0.09 150)", "oklch(0.24 0.03 168)"],
  },
  {
    key: "nebula",
    label: "Ungu Nebula",
    description: "Ungu magenta modern dengan kontras tinggi.",
    swatch: ["oklch(0.58 0.137 300)", "oklch(0.7 0.095 270)", "oklch(0.24 0.031 300)"],
  },
  {
    key: "senja",
    label: "Jingga Senja",
    description: "Hangat keemasan, kesan energik.",
    swatch: ["oklch(0.58 0.137 45)", "oklch(0.7 0.095 25)", "oklch(0.24 0.031 45)"],
  },
  {
    key: "titanium",
    label: "Abu Titanium",
    description: "Netral monokrom, minim warna dan sangat kalem.",
    swatch: ["oklch(0.58 0.033 255)", "oklch(0.7 0.022 245)", "oklch(0.24 0.008 255)"],
  },
];

export type FontOption = { key: string; label: string; note?: string };

/** Semua font dihosting sendiri di /public/fonts agar ter-load di hosting mana pun. */
export const fontOptions: FontOption[] = [
  { key: "nasalization", label: "Nasalization", note: "Bawaan aplikasi" },
  { key: "enjoy-journey", label: "Enjoy Journey" },
  { key: "spheris", label: "Spheris" },
  { key: "hey-comic", label: "Hey Comic" },
  { key: "tussilago", label: "Tussilago" },
  { key: "butler", label: "Butler" },
  { key: "kg-red-hands", label: "KG Red Hands" },
  { key: "last-christmas", label: "Last Christmas" },
  { key: "signatra", label: "Signatra" },
  { key: "comfortaa", label: "Comfortaa" },
  { key: "avengeance", label: "Avengeance" },
  { key: "bebas-neue", label: "Bebas Neue" },
  { key: "the-magic-cookie", label: "The Magic Cookie" },
  { key: "apple-garamond", label: "Apple Garamond" },
  { key: "creato-display", label: "Creato Display" },
  { key: "gang-of-three", label: "Gang of Three" },
  { key: "airstrike", label: "Airstrike" },
  { key: "machille", label: "Machille" },
  { key: "mermaid", label: "Mermaid" },
  { key: "la-petite-chanteuse", label: "La Petite Chanteuse" },
  { key: "oldnewspapertypes", label: "Old Newspaper Types" },
  { key: "granesta", label: "Granesta" },
  { key: "grime-slime", label: "Grime Slime" },
  { key: "peanut-butter", label: "Peanut Butter" },
  { key: "game-of-squids", label: "Game of Squids" },
  { key: "black-chancery", label: "Black Chancery" },
  { key: "maloney", label: "Maloney" },
  { key: "bakeri", label: "Bakeri" },
  { key: "magnolia-script", label: "Magnolia Script" },
  { key: "dunkin", label: "Dunkin" },
  { key: "dream-orphans", label: "Dream Orphans" },
  { key: "long-shot", label: "Long Shot" },
];

export const DEFAULT_THEME = "biru";
export const DEFAULT_FONT = "nasalization";

export type AppearanceRow = { theme_key: string; font_key: string };

export function useAppearance() {
  return useQuery({
    queryKey: ["app_appearance"],
    staleTime: 60_000,
    queryFn: async (): Promise<AppearanceRow> => {
      const { data, error } = await db
        .from("app_appearance")
        .select("theme_key,font_key")
        .eq("id", 1)
        .maybeSingle();
      if (error || !data) return { theme_key: DEFAULT_THEME, font_key: DEFAULT_FONT };
      return {
        theme_key: (data as AppearanceRow).theme_key || DEFAULT_THEME,
        font_key: (data as AppearanceRow).font_key || DEFAULT_FONT,
      };
    },
  });
}

export function useSaveAppearance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: Partial<AppearanceRow>) => {
      const { error } = await db
        .from("app_appearance")
        .upsert({ id: 1, ...v }, { onConflict: "id" });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["app_appearance"] });
    },
  });
}

/** Menerapkan tema & font terpilih ke elemen <html>. */
export function useApplyAppearance() {
  const { data } = useAppearance();
  const theme = data?.theme_key ?? DEFAULT_THEME;
  const font = data?.font_key ?? DEFAULT_FONT;

  useEffect(() => {
    const el = document.documentElement;
    el.dataset['theme'] = theme;
    el.dataset['font'] = font;
  }, [theme, font]);

  return { theme, font };
}
