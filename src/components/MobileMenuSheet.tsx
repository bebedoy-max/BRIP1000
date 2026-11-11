import { Link } from "@tanstack/react-router";
import { LogOut, X } from "lucide-react";
import { menuTree, useAccess } from "@/lib/access";
import { Badge } from "@/components/ui/badge";

/** Semua menu untuk mobile: grid ikon per kelompok (menggantikan drawer panjang). */
export function MobileMenuSheet({
  open,
  onClose,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  onSignOut: () => void;
}) {
  const { visibleMenus, levelLabel, session } = useAccess();
  if (!open) return null;

  const byKey = new Map(visibleMenus.map((m) => [m.key, m]));
  const sections: { title: string; keys: string[] }[] = [];
  const single: string[] = [];
  for (const node of menuTree) {
    if (node.type === "item") single.push(node.key);
    else sections.push({ title: node.label, keys: node.keys });
  }
  sections.unshift({ title: "Utama", keys: single });

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-label="Semua menu">
      <button
        type="button"
        aria-label="Tutup menu"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 top-10 bottom-0 flex flex-col rounded-t-[30px] bg-background shadow-2xl">
        <div className="mx-auto mt-2.5 h-1.5 w-11 rounded-full bg-muted-foreground/30" />
        <div className="flex items-center justify-between px-5 pt-3">
          <h2 className="text-xl font-extrabold">Semua menu</h2>
          <button
            type="button"
            aria-label="Tutup"
            onClick={onClose}
            className="grid size-10 place-items-center rounded-full bg-secondary"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pt-1 pb-28">
          {sections.map((sec) => {
            const items = sec.keys.map((k) => byKey.get(k)).filter(Boolean) as typeof visibleMenus;
            if (!items.length) return null;
            return (
              <section key={sec.title}>
                <h3 className="mt-5 mb-2 px-1 text-xs font-bold tracking-wider text-primary uppercase">
                  {sec.title}
                </h3>
                <div className="glass-card grid grid-cols-4 gap-x-1 gap-y-3.5 rounded-3xl px-2 py-3.5">
                  {items.map((m) => (
                    <Link
                      key={m.key}
                      to={m.to}
                      onClick={onClose}
                      className="flex flex-col items-center gap-1.5 px-0.5 text-center text-[11px] leading-tight font-medium"
                    >
                      <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                        <m.icon className="size-[22px]" />
                      </span>
                      {m.label}
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}

          <div className="glass-card mt-5 flex items-center justify-between gap-3 rounded-2xl p-3.5">
            <div className="min-w-0">
              <p className="truncate text-xs text-muted-foreground">{session?.user.email}</p>
              <Badge variant="secondary" className="mt-1 text-[10px]">
                {levelLabel}
              </Badge>
            </div>
            <button
              type="button"
              onClick={onSignOut}
              className="flex h-10 shrink-0 items-center gap-2 rounded-full bg-secondary px-4 text-sm font-semibold"
            >
              <LogOut className="size-4" /> Keluar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
