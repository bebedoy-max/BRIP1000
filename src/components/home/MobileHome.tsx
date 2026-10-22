import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarClock, LifeBuoy, Sunrise, Users, type LucideIcon } from "lucide-react";
import { useAccess } from "@/lib/access";

type Stat = { label: string; value: string | number; detailKey: string };

const quick: { key: string; to: string; label: string; icon: LucideIcon }[] = [
  { key: "pegawai", to: "/admin/pegawai", label: "Pekerja", icon: Users },
  { key: "doa-pagi", to: "/admin/doa-pagi", label: "Doa Pagi", icon: Sunrise },
  { key: "tiket", to: "/admin/tiket", label: "Tiket IT", icon: LifeBuoy },
  { key: "agenda", to: "/admin/agenda", label: "Agenda", icon: CalendarClock },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 19) return "Selamat sore";
  return "Selamat malam";
}

/** Beranda mobile: sapaan, ringkasan angka utama, dan akses cepat. Disembunyikan di desktop. */
export function MobileHome({ hero, stats }: { hero: Stat; stats: Stat[] }) {
  const { visibleMenus, levelLabel, session } = useAccess();
  const fromPath = useRouterState({ select: (s) => s.location.pathname });
  const allowed = new Set(visibleMenus.map((m) => m.key));
  const name = session?.user.email?.split("@")[0] ?? "";

  return (
    <section className="space-y-4 lg:hidden" aria-label="Ringkasan">
      <div>
        <p className="text-xs font-medium text-muted-foreground">{greeting()},</p>
        <h1 className="text-xl leading-tight font-extrabold">
          {name || "Admin"}{" "}
          <span className="text-sm font-semibold text-muted-foreground">· {levelLabel}</span>
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Link
          to="/detail/$key"
          params={{ key: hero.detailKey }}
          search={{ from: fromPath }}
          className="col-span-2 rounded-3xl bg-primary p-4 text-primary-foreground shadow-lg"
        >
          <p className="text-xs font-semibold opacity-90">{hero.label}</p>
          <p className="mt-1 text-4xl leading-none font-extrabold tabular-nums">{hero.value}</p>
        </Link>
        {stats.map((s) => (
          <Link
            key={s.detailKey}
            to="/detail/$key"
            params={{ key: s.detailKey }}
            search={{ from: fromPath }}
            className="glass-card rounded-2xl px-3.5 py-3"
          >
            <p className="text-[11.5px] font-semibold text-muted-foreground">{s.label}</p>
            <p className="mt-0.5 text-2xl font-extrabold tabular-nums">{s.value}</p>
          </Link>
        ))}
      </div>

      <div>
        <h2 className="mb-2 text-[15px] font-extrabold">Akses cepat</h2>
        <div className="grid grid-cols-4 gap-2">
          {quick
            .filter((q) => allowed.has(q.key))
            .map((q) => (
              <Link
                key={q.key}
                to={q.to}
                className="flex flex-col items-center gap-1.5 text-center text-[11px] font-semibold"
              >
                <span className="glass-card grid size-14 place-items-center rounded-2xl text-primary">
                  <q.icon className="size-6" />
                </span>
                {q.label}
              </Link>
            ))}
        </div>
      </div>
    </section>
  );
}
