import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

const db = supabase as unknown as SupabaseClient;

type Row = {
  id: string;
  judul: string;
  tanggal: string;
  waktu: string | null;
  lokasi: string | null;
};

/** Kalender ringkas: agenda mendatang yang diatur dari menu admin. */
export function UpcomingEvents() {
  const q = useQuery({
    queryKey: ["upcoming-agenda"],
    staleTime: 120_000,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await db
        .from("agenda")
        .select("id,judul,tanggal,waktu,lokasi")
        .eq("aktif", true)
        .gte("tanggal", today)
        .order("tanggal", { ascending: true })
        .limit(5);
      return (data ?? []) as Row[];
    },
  });
  const rows = q.data ?? [];

  return (
    <div className="glass-card flex h-full flex-col p-5">
      <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-accent uppercase">
        <CalendarClock className="size-4" /> Upcoming Event
      </p>
      {q.isLoading ? <p className="mt-3 text-sm text-muted-foreground">Memuat…</p> : null}
      {!q.isLoading && !rows.length ? (
        <p className="mt-3 text-sm text-muted-foreground">Belum ada agenda mendatang.</p>
      ) : null}
      <ul className="mt-3 space-y-2">
        {rows.map((e) => {
          const d = e.tanggal ? new Date(e.tanggal) : null;
          const sub = [e.waktu, e.lokasi].filter(Boolean).join(" · ");
          return (
            <li
              key={e.id}
              className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 p-2"
            >
              <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-secondary/70 text-center leading-none">
                <span className="text-sm font-bold tabular-nums">{d ? d.getDate() : "—"}</span>
                <span className="text-[10px] text-muted-foreground uppercase">
                  {d ? d.toLocaleDateString("id-ID", { month: "short" }) : ""}
                </span>
              </div>
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm">{e.judul}</p>
                {sub ? <p className="truncate text-[11px] text-muted-foreground">{sub}</p> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
