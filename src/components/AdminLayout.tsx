import { createContext, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { menuTree, useAccess } from "@/lib/access";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import logoUrl from "@/assets/logo.png";
import { AuthSplash } from "@/components/AuthSplash";
import { GlobalSearch } from "@/components/GlobalSearch";
import { MobileNav } from "@/components/MobileNav";
import { MobileMenuSheet } from "@/components/MobileMenuSheet";
import { MobileSearchSheet } from "@/components/MobileSearchSheet";
import { usePresenceHeartbeat, useSelfBlocked } from "@/lib/users";

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const itemClass =
  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-all duration-200 hover:metal-item hover:text-foreground [&.active]:metal-item-active [&.active]:text-foreground";

/** Navigasi sidebar dengan pengelompokan menu. */
function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { visibleMenus } = useAccess();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const byKey = new Map(visibleMenus.map((m) => [m.key, m]));
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <nav className="flex flex-col gap-1">
      {menuTree.map((node) => {
        if (node.type === "item") {
          const item = byKey.get(node.key);
          if (!item) return null;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              activeOptions={{ exact: item.to === "/admin" }}
              className={itemClass}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        }
        const children = node.keys.map((k) => byKey.get(k)).filter(Boolean) as typeof visibleMenus;
        if (!children.length) return null;
        const hasActive = children.some(
          (c) => pathname === c.to || pathname.startsWith(`${c.to}/`),
        );
        const expanded = open[node.key] ?? hasActive;
        return (
          <div key={node.key}>
            <button
              type="button"
              onClick={() => setOpen((s) => ({ ...s, [node.key]: !expanded }))}
              className={`w-full ${itemClass} ${hasActive ? "text-foreground" : ""}`}
            >
              <node.icon className="size-4" />
              <span className="flex-1 text-left">{node.label}</span>
              <ChevronDown
                className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`}
              />
            </button>
            {expanded ? (
              <div className="ml-4 mt-1 flex flex-col gap-1 border-l border-border/60 pl-2">
                {children.map((c) => (
                  <Link key={c.to} to={c.to} onClick={onNavigate} className={itemClass}>
                    <c.icon className="size-4" />
                    {c.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const { session, levelLabel } = useAccess();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  usePresenceHeartbeat();

  async function signOut() {
    const start = Date.now();
    setSigningOut(true);
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    const elapsed = Date.now() - start;
    await wait(Math.max(0, 2000 - elapsed));
    void navigate({ to: "/", replace: true });
  }

  if (signingOut) return <AuthSplash label="Bye My Friends.. See You Later...." />;

  const sidebarBody = (
    <>
      <Link to="/" className="mb-4 flex items-center gap-3 px-2" onClick={() => setMenuOpen(false)}>
        <img src={logoUrl} alt="Logo" className="h-14 w-auto object-contain" />
      </Link>
      <SidebarNav onNavigate={() => setMenuOpen(false)} />

      <div className="mt-auto space-y-3 pt-4">
        <div className="glass-card p-3">
          <p className="truncate text-xs text-muted-foreground">{session?.user.email}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            <Badge variant="secondary" className="text-[10px]">
              {levelLabel}
            </Badge>
          </div>
        </div>
        <Button variant="ghost" className="w-full justify-start" onClick={signOut}>
          <LogOut className="size-4" /> Keluar
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border/60 p-4 backdrop-blur-xl lg:flex">
        {sidebarBody}
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-border/60 bg-background/60 p-3 backdrop-blur-xl lg:justify-end">
          <Link to="/admin" aria-label="Beranda" className="shrink-0 lg:hidden">
            <img src={logoUrl} alt="BRI BO Pringsewu" className="h-9 w-auto object-contain" />
          </Link>
          <Badge variant="secondary" className="text-[10px] lg:hidden">
            {levelLabel}
          </Badge>
          <GlobalSearch className="hidden w-full max-w-md lg:block" />
        </header>
        <main className="p-4 pb-28 sm:p-6 lg:pb-6">{children}</main>
      </div>
      <MobileNav onOpenMenu={() => setMenuOpen(true)} onOpenSearch={() => setSearchOpen(true)} />
      <MobileMenuSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onSignOut={() => {
          setMenuOpen(false);
          void signOut();
        }}
      />
      <MobileSearchSheet open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}

export function AccessDenied() {
  return (
    <div className="glass-card p-10 text-center">
      <h1 className="text-xl font-semibold">Akses ditolak</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Anda tidak memiliki peran yang diperlukan untuk membuka halaman ini.
      </p>
    </div>
  );
}

/** Konteks hak edit untuk halaman admin yang sedang dibuka. */
export const PageEditContext = createContext(true);

/** Membungkus halaman admin dengan pengecekan hak akses menu (menu Akses Halaman). */
export function AdminPage({ menuKey, children }: { menuKey: string; children: ReactNode }) {
  const { loading, canAccess, canEdit } = useAccess();
  const blocked = useSelfBlocked();
  // Selama status blokir belum diketahui, halaman belum boleh dirender.
  const unknown = blocked.isLoading || blocked.data === undefined;
  return (
    <AdminLayout>
      {blocked.data ? (
        <div className="glass-card p-10 text-center">
          <h1 className="text-xl font-semibold">Akun diblokir</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Akun Anda diblokir oleh administrator. Hubungi admin untuk membuka blokir.
          </p>
        </div>
      ) : unknown || loading ? null : canAccess(menuKey) ? (
        <PageEditContext.Provider value={canEdit(menuKey)}>{children}</PageEditContext.Provider>
      ) : (
        <AccessDenied />
      )}
    </AdminLayout>
  );
}
