import { createServerFn } from "@tanstack/react-start";

export type PublicEventPhoto = { event_id: string; drive_file_id: string };
export type PublicEventPhotoRow = {
  id: string;
  event_id: string;
  drive_file_id: string;
  drive_view_link: string;
  file_name: string | null;
  matched_worker_ids: string[] | null;
  processed_at: string;
};

/**
 * Foto event untuk dashboard publik. Dibaca di server (service role) karena
 * tabel event_photos hanya bisa dibaca user terautentikasi; hanya id file
 * Drive & id event yang dikembalikan (tanpa data pribadi).
 */
export const getPublicEventPhotos = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicEventPhoto[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = supabaseAdmin as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          order: (
            c: string,
            o: { ascending: boolean },
          ) => {
            limit: (n: number) => Promise<{ data: PublicEventPhoto[] | null; error: { message: string } | null }>;
          };
        };
      };
    };
    const { data, error } = await client
      .from("event_photos")
      .select("event_id,drive_file_id,processed_at")
      .order("processed_at", { ascending: false })
      .limit(600);
    if (error) throw new Error(error.message);
    return (data ?? []).map((p) => ({
      event_id: p.event_id,
      drive_file_id: p.drive_file_id,
    }));
  },
);

export const getPublicEventPhotoPage = createServerFn({ method: "POST" })
  .inputValidator((input: { eventId?: string; offset?: number; limit?: number }) => input)
  .handler(async ({ data }): Promise<PublicEventPhotoRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as { from: (t: string) => any };
    const offset = Math.max(0, Math.floor(Number(data.offset ?? 0)));
    const limit = Math.min(96, Math.max(1, Math.floor(Number(data.limit ?? 48))));
    let query = db
      .from("event_photos")
      .select("id,event_id,drive_file_id,drive_view_link,file_name,matched_worker_ids,processed_at")
      .order("processed_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (data.eventId) query = query.eq("event_id", data.eventId);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return ((rows ?? []) as Record<string, unknown>[]).map((p) => {
      const fileId = String(p["drive_file_id"] ?? "");
      const viewLink = typeof p["drive_view_link"] === "string" && p["drive_view_link"]
        ? p["drive_view_link"]
        : `https://drive.google.com/file/d/${fileId}/view`;
      return {
        id: String(p["id"] ?? `${fileId}-${String(p["processed_at"] ?? "")}`),
        event_id: String(p["event_id"] ?? ""),
        drive_file_id: fileId,
        drive_view_link: viewLink,
        file_name: typeof p["file_name"] === "string" ? p["file_name"] : null,
        matched_worker_ids: Array.isArray(p["matched_worker_ids"])
          ? p["matched_worker_ids"].filter((v): v is string => typeof v === "string")
          : null,
        processed_at: typeof p["processed_at"] === "string" ? p["processed_at"] : new Date(0).toISOString(),
      };
    });
  });

/** Jumlah foto per event untuk pengunjung publik (tabel event_photos tertutup RLS). */
export const getPublicEventPhotoCounts = createServerFn({ method: "GET" }).handler(
  async (): Promise<Record<string, number>> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as { from: (t: string) => any };
    const counts: Record<string, number> = {};
    const PAGE = 1000;
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await db
        .from("event_photos")
        .select("event_id")
        .range(offset, offset + PAGE - 1);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as { event_id: string }[];
      for (const r of rows) counts[r.event_id] = (counts[r.event_id] ?? 0) + 1;
      if (rows.length < PAGE) break;
    }
    return counts;
  },
);
