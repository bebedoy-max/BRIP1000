import { useQuery } from "@tanstack/react-query";
import { Landmark, PiggyBank } from "lucide-react";
import { getBankRates } from "@/lib/home-feeds.functions";

/** Panel suku bunga Deposito & Giro BRI di bawah Info Pasar. */
export function BankRatesPanel() {
  const q = useQuery({
    queryKey: ["bank-rates"],
    queryFn: () => getBankRates(),
    staleTime: 3 * 60 * 60_000,
  });
  const data = q.data;

  if (q.isLoading) {
    return (
      <div className="glass-card flex flex-col gap-3 p-5">
        <p className="text-xs font-semibold tracking-[0.18em] text-accent uppercase">Suku Bunga BRI</p>
        <p className="text-sm text-muted-foreground">Memuat suku bunga…</p>
      </div>
    );
  }
  if (!data?.deposito && !data?.giro) return null;

  return (
    <div className="glass-card flex flex-col gap-3 p-5">
      <p className="text-xs font-semibold tracking-[0.18em] text-accent uppercase">Suku Bunga BRI</p>

      {data.deposito ? (
        <div className="relative overflow-hidden rounded-2xl border border-emerald-400/45 bg-gradient-to-b from-card/90 via-card/70 to-background/85 p-3 backdrop-blur-xl"
          style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -3px 8px rgba(0,0,0,0.45), 0 10px 22px -10px rgba(52,211,153,0.75), 0 0 22px -4px rgba(52,211,153,0.45)" }}
        >
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-2 top-0.5 h-1/2 rounded-2xl bg-gradient-to-b from-emerald-300/25 to-transparent opacity-70" />
          <div className="relative">
            <div className="flex items-center gap-1.5">
              <PiggyBank className="size-4 text-accent" />
              <p className="text-xs font-semibold">Deposito</p>
            </div>
            <p className="mt-2 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">Rupiah / tenor</p>
            <div className="mt-1 grid grid-cols-3 gap-1.5">
              {data.deposito.rupiah.map((r) => (
                <div key={r.tenor} className="rounded-lg border border-border/50 bg-background/50 px-1.5 py-1 text-center">
                  <p className="text-[10px] text-muted-foreground">{r.tenor}</p>
                  <p className="text-xs font-bold tabular-nums">{r.rate}</p>
                </div>
              ))}
            </div>
            {data.deposito.valas.length ? (
              <>
                <p className="mt-2 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">Valas / tenor</p>
                <div className="mt-1 grid grid-cols-4 gap-1.5">
                  {data.deposito.valas.map((r) => (
                    <div key={r.tenor} className="rounded-lg border border-border/50 bg-background/50 px-1 py-1 text-center">
                      <p className="text-[10px] text-muted-foreground">{r.tenor}</p>
                      <p className="text-xs font-bold tabular-nums">{r.rate}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
            {data.deposito.lastUpdate ? (
              <p className="mt-2 text-[10px] text-muted-foreground">Update: {data.deposito.lastUpdate}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {data.giro ? (
        <div className="relative overflow-hidden rounded-2xl border border-violet-400/45 bg-gradient-to-b from-card/90 via-card/70 to-background/85 p-3 backdrop-blur-xl"
          style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -3px 8px rgba(0,0,0,0.45), 0 10px 22px -10px rgba(167,139,250,0.75), 0 0 22px -4px rgba(167,139,250,0.45)" }}
        >
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-2 top-0.5 h-1/2 rounded-2xl bg-gradient-to-b from-violet-300/25 to-transparent opacity-70" />
          <div className="relative">
            <div className="flex items-center gap-1.5">
              <Landmark className="size-4 text-accent" />
              <p className="text-xs font-semibold">Giro (Jasa Giro)</p>
            </div>
            <div className="mt-2 space-y-1">
              {data.giro.tiers.map((t, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-border/50 bg-background/50 px-2 py-1">
                  <p className="text-[11px] text-muted-foreground">{t.label}</p>
                  <p className="text-xs font-bold tabular-nums">{t.rate}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <p className="text-[10px] text-muted-foreground">
        Sumber: bri.co.id &amp; eform.bri.co.id — bukan acuan transaksi.
      </p>
    </div>
  );
}
