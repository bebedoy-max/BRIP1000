import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarDays, Database, Home, LayoutGrid, type LucideIcon } from "lucide-react";
import { useAccess } from "@/lib/access";

type Tab = {
  key: string;
  to: string;
  label: string;
  icon: LucideIcon;
  /** Awalan path yang menandai tab ini aktif. */
  match: string[];
};

const tabs: Tab[] = [
  { key: "ringkasan", to: "/admin", label: "Beranda", icon: Home, match: [] },
  {
    key: "pegawai",
    to: "/admin/pegawai",
    label: "Database",
    icon: Database,
    match: [
      "/admin/uker",
      "/admin/pegawai",
      "/admin/atm",
      "/admin/crm",
      "/admin/edc",
      "/admin/qris",
      "/admin/perangkat",
    ],
  },
  {
    key: "project",
    to: "/admin/project",
    label: "Project",
    icon: CalendarDays,
    match: ["/admin/project", "/admin/foto", "/admin/agenda"],
  },
];

const tabClass =
  "flex min-w-14 flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 text-[10.5px] font-semibold text-muted-foreground transition-colors";

/** Navigasi bawah mengambang untuk mobile: tab utama + tombol Menu (buka semua menu). */
export function MobileNav({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { visibleMenus } = useAccess();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const allowed = new Set(visibleMenus.map((m) => m.key));

  return (
    <nav
      aria-label="Menu utama"
      className="glass-card fixed inset-x-3 bottom-3 z-40 flex items-center justify-around rounded-3xl p-1.5 shadow-lg backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: "max(0.375rem, env(safe-area-inset-bottom))" }}
    >
      {tabs
        .filter((t) => allowed.has(t.key))
        .map((t) => {
          const active =
            t.to === "/admin"
              ? pathname === "/admin" || pathname === "/admin/"
              : t.match.some((p) => pathname === p || pathname.startsWith(`${p}/`));
          return (
            <Link
              key={t.key}
              to={t.to}
              aria-current={active ? "page" : undefined}
              className={`${tabClass} ${active ? "bg-primary text-primary-foreground shadow" : "hover:text-foreground"}`}
            >
              <t.icon className="size-[22px]" />
              {t.label}
            </Link>
          );
        })}
      <button type="button" onClick={onOpenMenu} className={`${tabClass} hover:text-foreground`}>
        <LayoutGrid className="size-[22px]" />
        Menu
      </button>
    </nav>
  );
}
