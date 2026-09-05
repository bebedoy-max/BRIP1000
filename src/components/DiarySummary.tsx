import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { RotatingThumb } from "@/components/RotatingThumbGrid";
import { useDirectory } from "@/lib/directory";
// Frame di-bundle oleh Vite (bukan CDN eksternal) agar tetap termuat di hosting mana pun.
import frameUrl from "@/assets/diary-frame.png";
import { maskSensitiveText } from "@/lib/maskSensitive";



const db = supabase as unknown as SupabaseClient;

type DiaryRow = {
  id: string;
  user_id: string;
  tanggal: string;
  nama_kegiatan: string;
  detil_problem: string | null;
  status: string;
};

/** Warna glow unik per petugas IT (hash nama → hue stabil). */
function officerGlow(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `oklch(0.82 0.16 ${h})`;
}

/** Warna glow untuk status kegiatan. */
function statusGlow(s: string) {
  if (s === "Done") return "oklch(0.74 0.12 175)"; // success green
  if (s === "Failed") return "oklch(0.62 0.2 24)"; // destructive red
  return "oklch(0.72 0.11 235)"; // in-progress blue
}


export function statusVariant(s: string): "default" | "secondary" | "destructive" {
  if (s === "Done") return "default";
  if (s === "Failed") return "destructive";
  return "secondary";
}

const fmt = (d: string) => {
  const dt = new Date(`${d}T00:00:00`);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString("id-ID", { dateStyle: "medium" });
};

/** Ambil foto kegiatan harian IT untuk sekumpulan catatan. */
export async function loadDiaryPhotos(ids: string[]) {
  const map: Record<string, string[]> = {};
  if (!ids.length) return map;
  const { data } = await db
    .from("entity_photos")
    .select("entity_id,drive_file_id,created_at")
    .eq("entity_type", "buku-harian")
    .in("entity_id", ids)
    .order("created_at", { ascending: false })
    .limit(600);
  for (const p of (data ?? []) as { entity_id: string; drive_file_id: string }[]) {
    (map[p.entity_id] ??= []).push(p.drive_file_id);
  }
  return map;
}

/** Kluster kartu kegiatan harian IT dengan grid thumbnail acak. */
export function DiarySummary({ limit = 6 }: { limit?: number }) {
  const dir = useDirectory();
  const q = useQuery({
    queryKey: ["diary-thumb-summary", limit],
    queryFn: async () => {
      const { data, error } = await db
        .from("it_diary_logs")
        .select("id,user_id,tanggal,nama_kegiatan,detil_problem,status")
        .order("tanggal", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      const rows = (data ?? []) as DiaryRow[];
      const photos = await loadDiaryPhotos(rows.map((r) => r.id));
      return rows.map((r) => ({ ...r, photos: photos[r.id] ?? [] }));
    },
  });

  const rows = useMemo(() => q.data ?? [], [q.data]);

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Memuat kegiatan…</p>;
  if (!rows.length)
    return <p className="text-sm text-muted-foreground">Belum ada catatan kegiatan harian IT.</p>;

  return (
    <div
      className="grid justify-start"
      style={{
        gridTemplateColumns: "repeat(auto-fill, 360px)",
        gap: "16px",
        justifyContent: "start",
      }}
    >
      {rows.map((r) => (
        <DiaryCard
          key={r.id}
          title={r.nama_kegiatan}
          description={maskSensitiveText(r.detil_problem)}
          status={r.status}
          date={fmt(r.tanggal)}
          officer={dir.nameOf(r.user_id)}
          photos={r.photos}
        />
      ))}
    </div>
  );
}

/** Kartu kegiatan harian IT — memakai frame gambar, warna mengikuti tema aplikasi. */
export function DiaryCard({
  title,
  description = "",
  status,
  date: _date,
  officer,
  photos,
}: {
  title: string;
  description?: string;
  status: string;
  date: string;
  officer: string;
  photos: string[];
}) {
  const statusTone =
    status === "Failed"
      ? "text-destructive"
      : status === "Done"
        ? "text-[oklch(0.85_0.18_145)]"
        : "text-white";
  const statusGlowColor = statusGlow(status);

  const maskStyle = {
    WebkitMaskImage: `url(${frameUrl})`,
    maskImage: `url(${frameUrl})`,
    WebkitMaskSize: "100% 100%",
    maskSize: "100% 100%",
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
  } as const;

  return (
    <article className="relative w-[360px] [aspect-ratio:1842/1758] [container-type:inline-size]">
      {/* Frame dari gambar, diwarnai mengikuti tema aplikasi. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-primary/35"
        style={maskStyle}
      />

      {/* Nama kegiatan — strip kiri atas frame, digeser sedikit ke bawah agar ter-center antara batas bawah frame & batas atas box deskripsi. */}
      <h3
        className="absolute top-0 left-0 flex h-[11.5%] w-[70%] items-center px-[4cqw] pt-[3.4cqw] text-[clamp(10px,3.6cqw,14px)] leading-[1.05] font-extrabold text-foreground"
        title={title}
      >
        <span className="line-clamp-2 w-full overflow-hidden break-words">{title}</span>
      </h3>

      {/* Status — pada blok kanan atas frame dengan glow sesuai status. */}
      <span
        className={`diary-pulse-glow absolute top-0 right-0 flex h-[11.5%] w-[28.3%] items-center justify-center px-[1.5cqw] pb-[3.6cqw] text-[clamp(10px,3.6cqw,14px)] leading-none font-extrabold whitespace-nowrap ${statusTone}`}
        style={{ ["--diary-glow" as string]: statusGlowColor }}
      >
        <span className="truncate">{status}</span>
      </span>

      {/* Nama petugas — blok kiri bawah frame, naik sedikit agar center, teks putih + glow berwarna. */}
      <span
        className="diary-pulse-glow absolute bottom-0 left-0 flex h-[8.4%] w-[50.5%] items-center px-[4cqw] pb-[1cqw] text-[clamp(11px,4.2cqw,17px)] leading-[1.35] font-semibold text-white"
        style={{ ["--diary-glow" as string]: officerGlow(officer) }}
      >
        <span className="truncate">{officer.replace(/\bPetugas IT\b/g, "Pet. IT")}</span>
      </span>

      {/* Area isi di dalam frame. */}
      <div className="absolute top-[11.5%] right-[1.3%] bottom-[8.4%] left-[1.3%] flex flex-col gap-[2.5cqw] p-[2.5cqw]">
        <div
          className="overflow-hidden rounded-[0.9rem] bg-primary/25 px-[3.5cqw] py-[2.8cqw] ring-1 ring-primary/25"
          title={description || undefined}
        >
          <p className="line-clamp-2 text-left text-[clamp(10px,3.2cqw,13px)] leading-[1.35] font-normal break-all text-foreground/85">
            {description || "Tidak ada deskripsi."}
          </p>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-[1.8cqw]">
          {Array.from({ length: 4 }, (_, slot) => (
            <div key={slot} className="overflow-hidden rounded-[0.7rem] bg-background/60">
              <RotatingThumb
                ids={photos.filter((_, i) => i % 4 === slot)}
                alt={`Foto kegiatan ${title}`}
                delay={slot * 700}
                className="h-full w-full"
              />
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}







