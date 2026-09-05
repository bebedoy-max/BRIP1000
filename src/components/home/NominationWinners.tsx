import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { getPublicNominasiWinners } from "@/lib/home-feeds.functions";

/** Kartu pemenang nominasi terbaru (nominee pertama tiap kategori). */
export function NominationWinners() {
  const q = useQuery({
    queryKey: ["home-nominasi-winner"],
    staleTime: 300_000,
    queryFn: () => getPublicNominasiWinners(),
  });

  const winners = (q.data?.winners ?? []).map((w) => ({
    category: w.category,
    nominee: { name: w.name, position: w.position, photo: w.photo },
  }));


  return (
    <div className="glass-card flex h-fit flex-col p-5">
      <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-accent uppercase">
        <Trophy className="size-4" /> Nominasi Winner
      </p>
      <p className="mt-1 text-sm font-semibold">{q.data?.title ?? "Best Performance"}</p>
      {q.isLoading ? <p className="mt-3 text-sm text-muted-foreground">Memuat…</p> : null}
      {!q.isLoading && !winners.length ? (
        <p className="mt-3 text-sm text-muted-foreground">Belum ada pemenang dipublikasikan.</p>
      ) : null}
      <ul className="mt-3 space-y-3">
        {winners.map((w) => (
          <li key={w.category} className="flex items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border border-border/60 bg-secondary/60">
              {w.nominee?.photo ? (
                <img src={w.nominee.photo} alt={w.nominee.name} className="size-full object-cover" />
              ) : (
                <Trophy className="size-4 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{w.nominee?.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {w.category} · {w.nominee?.position}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
