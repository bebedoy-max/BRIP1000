import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BookOpen, Home, type LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { menuItems } from "@/lib/access";
import { superItApps, superItTopicKey } from "@/lib/superit-apps";

const db = supabase as unknown as SupabaseClient;

export type TutorialRow = {
  id: string;
  topic_key: string;
  judul: string;
  ringkasan: string | null;
  konten: string | null;
  urutan: number;
  updated_at?: string | null;
};

export type TutorialTopic = {
  key: string;
  label: string;
  icon: LucideIcon;
  group: string;
  /** Konteks singkat fitur (dipakai saat membuat panduan otomatis). */
  konteks?: string;
};

/** Topik umum di luar menu sidebar (halaman publik). */
const umumTopics: TutorialTopic[] = [
  { key: "umum", label: "Pengenalan Aplikasi", icon: BookOpen, group: "Umum" },
  { key: "dashboard-publik", label: "Dashboard Publik", icon: Home, group: "Umum" },
];

/**
 * Daftar topik panduan. Otomatis mengikuti daftar menu aplikasi dan seluruh
 * fitur pada menu SuperIT Apps, sehingga penambahan/pengurangan fitur langsung
 * muncul di halaman Tutorial tanpa perubahan kode.
 */
export function tutorialTopics(): TutorialTopic[] {
  const fromMenus: TutorialTopic[] = menuItems.map((m) => ({
    key: m.key,
    label: m.label,
    icon: m.icon,
    group: "Menu Aplikasi",
  }));
  const fromApps: TutorialTopic[] = superItApps.map((a) => ({
    key: superItTopicKey(a.key),
    label: `SuperIT · ${a.label}`,
    icon: a.icon,
    group: "SuperIT Apps",
    konteks: a.description,
  }));
  return [...umumTopics, ...fromMenus, ...fromApps];
}


/** Kelompokkan topik berdasarkan grup, urutan grup mengikuti kemunculan. */
export function groupTopics(topics: TutorialTopic[]) {
  const map = new Map<string, TutorialTopic[]>();
  for (const t of topics) {
    const arr = map.get(t.group) ?? [];
    arr.push(t);
    map.set(t.group, arr);
  }
  return [...map.entries()].map(([group, items]) => ({ group, items }));
}

export function useTutorials() {
  return useQuery({
    queryKey: ["tutorials"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await db
        .from("tutorials")
        .select("id,topic_key,judul,ringkasan,konten,urutan,updated_at")
        .order("urutan", { ascending: true });
      if (error) return [] as TutorialRow[];
      return (data ?? []) as TutorialRow[];
    },
  });
}

export function useSaveTutorial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      topic_key: string;
      judul: string;
      ringkasan: string;
      konten: string;
    }) => {
      const { error } = await db
        .from("tutorials")
        .upsert(
          {
            topic_key: input.topic_key,
            judul: input.judul,
            ringkasan: input.ringkasan || null,
            konten: input.konten || null,
          },
          { onConflict: "topic_key" },
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tutorials"] }),
  });
}

export function useDeleteTutorial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (topicKey: string) => {
      const { error } = await db.from("tutorials").delete().eq("topic_key", topicKey);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tutorials"] }),
  });
}

export type ContentBlock =
  | { type: "heading"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "steps"; items: string[] }
  | { type: "paragraph"; text: string };

/**
 * Rapikan markdown yang tersimpan tanpa line break. Konten hasil generator
 * kadang berbentuk "Paragraf ## Judul - poin 1. langkah" dalam satu baris.
 */
function normalizeContent(raw: string): string {
  return raw
    .replace(/\s+(#{1,6})\s+/g, "\n$1 ")
    .replace(/\s+([-*•])\s+/g, "\n$1 ")
    .replace(/\s+(\d+[.)])\s+/g, "\n$1 ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Parser ringan: '## judul', '- poin', '1. langkah', sisanya paragraf. */
export function parseContent(raw: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  let bullets: string[] = [];
  let steps: string[] = [];
  const flush = () => {
    if (bullets.length) blocks.push({ type: "bullets", items: bullets });
    if (steps.length) blocks.push({ type: "steps", items: steps });
    bullets = [];
    steps = [];
  };
  for (const line of normalizeContent(raw).split(/\r?\n/)) {
    const t = line.trim();
    if (!t) {
      flush();
      continue;
    }
    if (/^#{1,6}\s+/.test(t)) {
      flush();
      blocks.push({ type: "heading", text: t.replace(/^#{1,6}\s+/, "") });
    } else if (/^[-*•]\s+/.test(t)) {
      if (steps.length) flush();
      bullets.push(t.replace(/^[-*•]\s+/, ""));
    } else if (/^\d+[.)]\s+/.test(t)) {
      if (bullets.length) flush();
      steps.push(t.replace(/^\d+[.)]\s+/, ""));
    } else {
      flush();
      blocks.push({ type: "paragraph", text: t });
    }
  }
  flush();
  return blocks;
}
