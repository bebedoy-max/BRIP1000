import { createServerFn } from "@tanstack/react-start";

export type EventLikeCount = { event_id: string; likes: number };

/** Jumlah like tiap event (dibaca di server supaya pengunjung anonim tetap dapat data). */
export const getEventLikes = createServerFn({ method: "GET" }).handler(
  async (): Promise<EventLikeCount[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as { from: (t: string) => any };
    const { data, error } = await db.from("event_likes").select("event_id").limit(20000);
    if (error) return [];
    const map: Record<string, number> = {};
    for (const row of (data ?? []) as { event_id: string }[]) {
      map[row.event_id] = (map[row.event_id] ?? 0) + 1;
    }
    return Object.entries(map).map(([event_id, likes]) => ({ event_id, likes }));
  },
);

/** Toggle like satu event untuk satu visitor. Mengembalikan status & jumlah terbaru. */
export const toggleEventLike = createServerFn({ method: "POST" })
  .inputValidator((input: { eventId: string; visitorId: string }) => input)
  .handler(async ({ data }): Promise<{ liked: boolean; likes: number }> => {
    const eventId = String(data.eventId ?? "").trim();
    const visitorId = String(data.visitorId ?? "").trim().slice(0, 64);
    if (!eventId || !visitorId) throw new Error("Parameter like tidak valid.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as { from: (t: string) => any };

    const existing = await db
      .from("event_likes")
      .select("id")
      .eq("event_id", eventId)
      .eq("visitor_id", visitorId)
      .maybeSingle();
    if (existing.error) throw new Error(existing.error.message);

    let liked: boolean;
    if (existing.data) {
      const { error } = await db.from("event_likes").delete().eq("id", existing.data.id);
      if (error) throw new Error(error.message);
      liked = false;
    } else {
      const { error } = await db
        .from("event_likes")
        .insert({ event_id: eventId, visitor_id: visitorId });
      if (error) throw new Error(error.message);
      liked = true;
    }

    const { count } = await db
      .from("event_likes")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId);
    return { liked, likes: Number(count ?? 0) };
  });
