import type { LucideIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";

export type InfographicStat = {
  label: string;
  value: number | string;
  icon: LucideIcon;
  detailKey: string;
  /** 0..100 untuk bar infografis. */
  ratio: number;
  /** Deskripsi singkat pada kartu. */
  description?: string;
};

/** Infografis "connected pill badges" zig-zag — setiap pill dapat diklik. */
export function InfographicStats({ items }: { items: InfographicStat[] }) {
  return (
    <section className="glass-card relative isolate h-fit overflow-hidden p-3.5">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -right-12 -z-10 size-40 rounded-full opacity-30 blur-3xl"
        style={{ backgroundImage: "var(--gradient-stat)" }}
      />

      <header className="relative z-10">
        <h2 className="text-lg leading-none font-black tracking-tight">
          INFO<span className="gradient-text">GRAFIS</span>
        </h2>
        <div className="mt-1.5 h-px w-16 bg-gradient-to-r from-primary to-transparent" />
        <p className="mt-1.5 text-[8px] leading-snug tracking-[0.14em] text-muted-foreground uppercase">
          BO Pringsewu
        </p>
      </header>

      <div className="relative mt-3.5">
        <ol className="relative z-10 grid grid-cols-2 gap-2">
          {items.map((s, i) => {
            // Jumlah ganjil: kartu terakhir melebar penuh agar baris bawah rata.
            const lastOdd = i === items.length - 1 && items.length % 2 === 1;
            return (
              <li key={s.label} className={`min-w-0 ${lastOdd ? "col-span-2" : ""}`}>
                <Link
                  to="/detail/$key"
                  params={{ key: s.detailKey }}
                  search={{ from: "/" }}
                  aria-label={`Lihat detail ${s.label}`}
                  className="group relative flex w-full items-center gap-2 rounded-[999px] border border-primary/30 border-t-primary/50 border-b-background/70 bg-gradient-to-b from-card/90 via-card/70 to-background/80 px-2.5 py-1.5 backdrop-blur-xl transition-all duration-300 [box-shadow:inset_0_1px_0_color-mix(in_oklab,var(--primary)_35%,transparent),inset_0_-2px_6px_color-mix(in_oklab,black_45%,transparent),0_6px_14px_-6px_color-mix(in_oklab,black_75%,transparent),0_2px_0_color-mix(in_oklab,var(--primary)_18%,transparent)] hover:-translate-y-1 hover:border-primary/60 hover:[box-shadow:inset_0_1px_0_color-mix(in_oklab,var(--primary)_55%,transparent),inset_0_-2px_8px_color-mix(in_oklab,black_45%,transparent),0_14px_26px_-10px_color-mix(in_oklab,var(--primary)_70%,transparent)] active:translate-y-0 active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-3 top-0.5 h-1/2 rounded-full bg-gradient-to-b from-primary-foreground/20 to-transparent opacity-60"
                  />

                  <span className="relative grid size-8 shrink-0 place-items-center rounded-full border border-primary/40 bg-gradient-to-b from-primary/25 to-primary/5 [box-shadow:inset_0_1px_1px_color-mix(in_oklab,white_25%,transparent)]">
                    <s.icon className="size-4 text-accent" />
                  </span>

                  <span className="relative min-w-0 flex-1">
                    <span className="block text-[9px] leading-tight font-extrabold tracking-[0.08em] break-words text-foreground/85 uppercase drop-shadow-[0_1px_0_color-mix(in_oklab,black_60%,transparent)] sm:text-[10px]">
                      {s.label}
                    </span>
                    <span className="block text-base leading-tight font-black tabular-nums drop-shadow-[0_1px_1px_color-mix(in_oklab,black_65%,transparent)]">
                      {s.value}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
