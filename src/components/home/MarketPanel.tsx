import { useQuery } from "@tanstack/react-query";
import { TrendingDown, TrendingUp } from "lucide-react";
import { getMarketQuotes } from "@/lib/home-feeds.functions";

/** Warna glow per instrumen: BBRI biru, USD/IDR merah, emas kuning. */
const GLOW: Record<string, { ring: string; shadow: string; sheen: string }> = {
  bbri: {
    ring: "border-sky-400/45",
    shadow:
      "inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -3px 8px rgba(0,0,0,0.45), 0 10px 22px -10px rgba(56,189,248,0.75), 0 0 22px -4px rgba(56,189,248,0.45)",
    sheen: "from-sky-300/25",
  },
  usdidr: {
    ring: "border-rose-400/45",
    shadow:
      "inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -3px 8px rgba(0,0,0,0.45), 0 10px 22px -10px rgba(244,63,94,0.75), 0 0 22px -4px rgba(244,63,94,0.45)",
    sheen: "from-rose-300/25",
  },
  xau: {
    ring: "border-amber-300/50",
    shadow:
      "inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -3px 8px rgba(0,0,0,0.45), 0 10px 22px -10px rgba(251,191,36,0.8), 0 0 22px -4px rgba(251,191,36,0.5)",
    sheen: "from-amber-200/30",
  },
};

/** Panel info pasar: saham BBRI, kurs dolar, dan harga emas. */
export function MarketPanel() {
  const q = useQuery({
    queryKey: ["market-quotes"],
    queryFn: () => getMarketQuotes(),
    staleTime: 300_000,
  });
  const rows = q.data ?? [];

  return (
    <div className="glass-card flex h-full flex-col gap-3 p-5">
      <p className="text-xs font-semibold tracking-[0.18em] text-accent uppercase">Info Pasar</p>
      {q.isLoading ? <p className="text-sm text-muted-foreground">Memuat data pasar…</p> : null}
      {!q.isLoading && !rows.length ? (
        <p className="text-sm text-muted-foreground">Data pasar belum tersedia.</p>
      ) : null}
      {rows.map((r) => {
        const up = (r.change ?? 0) >= 0;
        const Icon = up ? TrendingUp : TrendingDown;
        const g = GLOW[r.key] ?? GLOW["bbri"]!;
        return (
          <div
            key={r.key}
            className={`group relative overflow-hidden rounded-2xl border ${g.ring} bg-gradient-to-b from-card/90 via-card/70 to-background/85 p-3 backdrop-blur-xl transition-transform duration-300 hover:-translate-y-1`}
            style={{ boxShadow: g.shadow }}
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute inset-x-2 top-0.5 h-1/2 rounded-2xl bg-gradient-to-b ${g.sheen} to-transparent opacity-70`}
            />
            <div className="relative">
              <p className="text-xs text-muted-foreground">{r.label}</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]">
                {r.value}
              </p>
              <div className="mt-1 flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">{r.unit}</span>
                {r.change !== null ? (
                  <span className={`flex items-center gap-1 ${up ? "text-accent" : "text-destructive"}`}>
                    <Icon className="size-3.5" />
                    {up ? "+" : ""}
                    {r.change.toFixed(2)}%
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
      <p className="mt-auto text-[10px] text-muted-foreground">
        Sumber data pasar diperbarui berkala; bukan acuan transaksi.
      </p>
    </div>
  );
}
