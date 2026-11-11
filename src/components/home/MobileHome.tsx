import { Link, useRouterState } from "@tanstack/react-router";
import {
  Banknote,
  CalendarClock,
  CalendarDays,
  LifeBuoy,
  QrCode,
  Sunrise,
  Users,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import { useAccess } from "@/lib/access";

type Stat = { label: string; value: string | number; detailKey: string };

const quick: { key: string; to: string; label: string; icon: LucideIcon }[] = [
  { key: "pegawai", to: "/admin/pegawai", label: "Pekerja", icon: Users },
  { key: "qris", to: "/admin/qris", label: "QRIS", icon: QrCode },
  { key: "atm", to: "/admin/atm", label: "ATM", icon: Banknote },
  { key: "doa-pagi", to: "/admin/doa-pagi", label: "Doa Pagi", icon: Sunrise },
  { key: "tiket", to: "/admin/tiket", label: "Tiket IT", icon: LifeBuoy },
  { key: "agenda", to: "/admin/agenda", label: "Agenda", icon: CalendarClock },
  { key: "project", to: "/admin/project", label: "Project", icon: CalendarDays },
  { key: "buku-harian", to: "/admin/buku-harian", label: "Buku Harian", icon: BookOpen },
];

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 19) return "Selamat sore";
  return "Selamat malam";
}

/**
 * Beranda mobile: kartu hero gradasi (total pekerja), strip angka yang menimpa hero,
 * dan akses cepat 4×2. Disembunyikan di desktop.
 */
export function MobileHome({
  hero,
  subtitle,
  stats,
}: {
  hero: Stat;
  subtitle: string;
  stats: Stat[];
}) {
  const { visibleMenus, session } = useAccess();
  const fromPath = useRouterState({ select: (s) => s.location.pathname });
  const allowed = new Set(visibleMenus.map((m) => m.key));
  const name = session?.user.email?.split("@")[0] ?? "Admin";

  return (
    <section className="lg:hidden" aria-label="Ringkasan">
      <Link
        to="/detail/$key"
        params={{ key: hero.detailKey }}
        search={{ from: fromPath }}
        className="block rounded-[28px] bg-gradient-to-br from-primary to-primary/70 px-5 pt-5 pb-12 text-primary-foreground shadow-lg"
      >
        <p className="text-xs font-semibold opacity-90">
          {greeting()}, {name}
        </p>
        <p className="mt-3 text-[13px] opacity-90">{hero.label}</p>
        <p className="text-5xl leading-none font-extrabold tabular-nums">{hero.value}</p>
        <p className="mt-1.5 text-xs opacity-90">{subtitle}</p>
      </Link>

      <div className="glass-card relative -mt-9 mx-1 grid grid-cols-4 rounded-3xl py-3.5 shadow-lg">
        {stats.map((s, i) => (
          <Link
            key={s.detailKey}
            to="/detail/$key"
            params={{ key: s.detailKey }}
            search={{ from: fromPath }}
            className={`text-center ${i ? "border-l border-border/60" : ""}`}
          >
            <p className="text-lg font-extrabold tabular-nums">{s.value}</p>
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
          </Link>
        ))}
      </div>

      <h2 className="mt-5 mb-2.5 px-1 text-base font-bold">Akses cepat</h2>
      <div className="grid grid-cols-4 gap-x-1 gap-y-3.5">
        {quick
          .filter((q) => allowed.has(q.key))
          .map((q) => (
            <Link
              key={q.key}
              to={q.to}
              className="flex flex-col items-center gap-1.5 text-center text-[11.5px] leading-tight font-medium"
            >
              <span className="glass-card grid size-14 place-items-center rounded-2xl text-primary">
                <q.icon className="size-6" />
              </span>
              {q.label}
            </Link>
          ))}
      </div>
    </section>
  );
}
