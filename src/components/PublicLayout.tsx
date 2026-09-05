import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Building2, LayoutDashboard, LogIn, ShieldCheck } from "lucide-react";
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
          <nav className="ml-auto flex items-center gap-1 sm:gap-1">
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
                <Link
                  to="/auth"
                  aria-label="Masuk"
                  title="Masuk"
                >
                  <LogIn className="size-4 max-sm:size-6" />
                  <span className="max-sm:hidden">Masuk</span>
                </Link>
              </Button>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6">{children}</main>
      <footer className="mx-auto max-w-[1280px] px-4 pb-10 text-xs text-muted-foreground sm:px-6">
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
    </div>
  );
}
