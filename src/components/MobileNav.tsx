import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Menu, Search } from "lucide-react";

const side =
  "grid size-12 place-items-center rounded-full text-slate-300 transition-colors hover:text-white";

/** Dock bawah mobile: Beranda, tombol Cari besar di tengah (membuka panel cari), dan Menu. */
export function MobileNav({
  onOpenMenu,
  onOpenSearch,
}: {
  onOpenMenu: () => void;
  onOpenSearch: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const homeActive = pathname === "/admin" || pathname === "/admin/";

  return (
    <nav
      aria-label="Menu utama"
      className="fixed inset-x-8 bottom-4 z-40 flex h-16 items-center justify-between rounded-full bg-slate-900/95 px-2 shadow-2xl shadow-black/40 backdrop-blur-xl lg:hidden"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <Link
        to="/admin"
        aria-label="Beranda"
        aria-current={homeActive ? "page" : undefined}
        className={`${side} ${homeActive ? "bg-white/15 text-white" : ""}`}
      >
        <Home className="size-[23px]" />
      </Link>
      <button
        type="button"
        onClick={onOpenSearch}
        aria-label="Cari"
        className="-mt-7 grid size-16 place-items-center rounded-full border-4 border-background bg-primary text-primary-foreground shadow-lg shadow-primary/40"
      >
        <Search className="size-[26px]" />
      </button>
      <button type="button" onClick={onOpenMenu} aria-label="Semua menu" className={side}>
        <Menu className="size-[23px]" />
      </button>
    </nav>
  );
}
