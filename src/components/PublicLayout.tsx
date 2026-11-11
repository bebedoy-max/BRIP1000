import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Building2, LayoutDashboard, Lock, LogIn, ShieldCheck } from "lucide-react";
import { useSession } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import logoUrl from "@/assets/logo.png";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/profil", label: "Profil Kantor", icon: Building2 },
  { to: "/informasi", label: "Informasi", icon: ShieldCheck },
] as const;

export function PublicLayout({ children }: { children: ReactNode }) {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1280px] items-center gap-3 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <img src={logoUrl} alt="Logo" className="h-14 w-auto object-contain" />
          </Link>
          <nav className="ml-auto hidden items-center gap-1 sm:flex">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                aria-label={item.label}
                title={item.label}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground max-sm:size-11 max-sm:justify-center max-sm:px-0 [&.active]:bg-secondary [&.active]:text-foreground"
                activeOptions={{ exact: item.to === "/" }}
              >
                <item.icon className="size-6 sm:hidden" />
                <span className="max-sm:hidden">{item.label}</span>
              </Link>
            ))}
            {!session && (
              <Button asChild size="sm" className="ml-2 max-sm:size-11 max-sm:px-0">
                <Link to="/auth" aria-label="Masuk" title="Masuk">
                  <LogIn className="size-4 max-sm:size-6" />
                  <span className="max-sm:hidden">Masuk</span>
                </Link>
              </Button>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-[1280px] px-4 py-6 pb-28 sm:px-6 sm:py-8 sm:pb-8">
        {children}
      </main>
      <footer className="mx-auto max-w-[1280px] px-4 pb-28 text-xs sm:pb-10 text-muted-foreground sm:px-6">
        <p>&copy; {new Date().getFullYear()} BRI Branch Office Pringsewu — AAFathers (Dev)</p>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          <Link
            to="/privacy-policy"
            className="transition-colors hover:text-foreground hover:underline"
          >
            Kebijakan Privasi
          </Link>
          <Link
            to="/terms-of-service"
            className="transition-colors hover:text-foreground hover:underline"
          >
            Ketentuan Layanan
          </Link>
        </div>
      </footer>
      <PublicDock loggedIn={!!session} />
    </div>
  );
}

const dockSide =
  "flex flex-col items-center justify-center gap-0.5 rounded-full py-1.5 text-[10px] font-semibold text-slate-300 transition-colors hover:text-white [&.active]:bg-white/15 [&.active]:text-white";

/** Dock bawah mobile untuk halaman publik: tombol Masuk/Panel besar di tengah. */
function PublicDock({ loggedIn }: { loggedIn: boolean }) {
  return (
    <nav
      aria-label="Menu utama"
      className="fixed inset-x-4 bottom-4 z-40 grid h-16 grid-cols-[1fr_1fr_auto_1fr_1fr] items-center gap-1 rounded-full bg-slate-900/95 px-2 shadow-2xl shadow-black/40 backdrop-blur-xl sm:hidden"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <Link to="/" activeOptions={{ exact: true }} className={dockSide}>
        <LayoutDashboard className="size-[22px]" />
        Beranda
      </Link>
      <Link to="/profil" className={dockSide}>
        <Building2 className="size-[22px]" />
        Profil
      </Link>
      <Link
        to={loggedIn ? "/admin" : "/auth"}
        aria-label={loggedIn ? "Buka panel" : "Masuk"}
        className="-mt-7 mx-2 grid size-16 place-items-center rounded-full border-4 border-background bg-primary text-primary-foreground shadow-lg shadow-primary/40"
      >
        <LogIn className="size-[26px]" />
      </Link>
      <Link to="/informasi" className={dockSide}>
        <ShieldCheck className="size-[22px]" />
        Informasi
      </Link>
      <Link to="/privacy-policy" className={dockSide}>
        <Lock className="size-[22px]" />
        Privasi
      </Link>
    </nav>
  );
}
