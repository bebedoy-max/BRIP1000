import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Clock, Filter, Loader2, Search, X } from "lucide-react";
import { HitRow, useGlobalSearch, type Group, type Hit } from "@/components/GlobalSearch";
import { useAccess } from "@/lib/access";

const RECENT_KEY = "mobile-search-recent";

function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 6) : [];
  } catch {
    return [];
  }
}

function saveRecent(term: string) {
  const t = term.trim();
  if (t.length < 2) return;
  try {
    const next = [t, ...readRecent().filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(
      0,
      6,
    );
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* penyimpanan tidak tersedia: abaikan */
  }
}

/**
 * Panel pencarian mobile (bottom sheet): ketik, hasil langsung dikelompokkan per menu.
 * Menu aplikasi yang cocok ikut muncul sehingga pencarian juga berfungsi sebagai pintasan.
 */
export function MobileSearchSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { visibleMenus } = useAccess();
  const [q, setQ] = useState("");
  const [only, setOnly] = useState("all");
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const { term, groups, totalHits, isFetching } = useGlobalSearch(q);

  useEffect(() => {
    if (!open) return;
    setRecent(readRecent());
    const t = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => window.clearTimeout(t);
  }, [open]);

  const menuHits = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    return visibleMenus.filter((m) => m.label.toLowerCase().includes(t)).slice(0, 5);
  }, [q, visibleMenus]);

  if (!open) return null;

  const shown = only === "all" ? groups : groups.filter((g) => g.module.route === only);
  const searching = term.length >= 2;

  function close() {
    onClose();
    setQ("");
    setOnly("all");
  }

  function goToRow(g: Group, hit: Hit) {
    saveRecent(term);
    close();
    void navigate({ to: g.module.route, search: { q: term, focus: hit.id } });
  }

  function goToFilter(g: Group) {
    saveRecent(term);
    close();
    void navigate({ to: g.module.route, search: { q: term } });
  }

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-label="Pencarian">
      <button
        type="button"
        aria-label="Tutup pencarian"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={close}
      />
      <div className="absolute inset-x-0 top-10 bottom-0 flex flex-col rounded-t-[30px] bg-background shadow-2xl">
        <div className="mx-auto mt-2.5 h-1.5 w-11 rounded-full bg-muted-foreground/30" />
        <div className="flex items-center gap-2 px-4 pt-3">
          <div className="flex h-12 flex-1 items-center gap-2.5 rounded-full border-[1.5px] border-primary bg-card/70 pr-1.5 pl-4">
            <Search className="size-[19px] shrink-0 text-primary" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari pekerja, merchant, mesin, menu…"
              aria-label="Cari"
              className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
            />
            {q ? (
              <button
                type="button"
                aria-label="Hapus"
                onClick={() => {
                  setQ("");
                  setOnly("all");
                  inputRef.current?.focus();
                }}
                className="grid size-9 place-items-center rounded-full bg-secondary"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={close}
            className="px-1 py-2 text-sm font-semibold text-primary"
          >
            Tutup
          </button>
        </div>

        {groups.length > 1 ? (
          <div className="no-scrollbar mt-2.5 flex gap-2 overflow-x-auto px-4">
            {[
              { route: "all", label: "Semua", total: totalHits },
              ...groups.map((g) => ({
                route: g.module.route,
                label: g.module.label,
                total: g.total,
              })),
            ].map((c) => (
              <button
                key={c.route}
                type="button"
                onClick={() => setOnly(c.route)}
                className={`h-9 shrink-0 rounded-full border px-3.5 text-[13px] font-semibold ${
                  only === c.route
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card/60"
                }`}
              >
                {c.label} {c.total}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto px-4 pt-2 pb-28">
          {!searching ? (
            <>
              {recent.length ? (
                <>
                  <h3 className="mt-3 mb-2 text-sm font-bold">Terakhir dicari</h3>
                  <div className="glass-card divide-y divide-border/50 rounded-2xl">
                    {recent.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setQ(r)}
                        className="flex w-full items-center gap-3 px-3.5 py-3 text-left text-sm font-medium"
                      >
                        <Clock className="size-4 text-muted-foreground" />
                        {r}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
              <h3 className="mt-4 mb-2 text-sm font-bold">Menu cepat</h3>
              <div className="flex flex-wrap gap-2">
                {visibleMenus.slice(0, 8).map((m) => (
                  <Link
                    key={m.key}
                    to={m.to}
                    onClick={close}
                    className="flex h-9 items-center gap-1.5 rounded-full border border-border bg-card/60 px-3.5 text-[13px] font-semibold"
                  >
                    <m.icon className="size-4 text-primary" />
                    {m.label}
                  </Link>
                ))}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Ketik minimal 2 huruf untuk mencari di seluruh data aplikasi.
              </p>
            </>
          ) : (
            <>
              {menuHits.length ? (
                <>
                  <h3 className="mt-3 mb-2 text-xs font-bold tracking-wide text-muted-foreground uppercase">
                    Menu
                  </h3>
                  <div className="glass-card divide-y divide-border/50 rounded-2xl">
                    {menuHits.map((m) => (
                      <Link
                        key={m.key}
                        to={m.to}
                        onClick={() => {
                          saveRecent(term);
                          close();
                        }}
                        className="flex items-center gap-3 px-3.5 py-3 text-sm font-semibold"
                      >
                        <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
                          <m.icon className="size-[18px]" />
                        </span>
                        {m.label}
                      </Link>
                    ))}
                  </div>
                </>
              ) : null}

              {isFetching && groups.length === 0 ? (
                <p className="flex items-center gap-2 px-1 py-4 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Mencari…
                </p>
              ) : shown.length === 0 && menuHits.length === 0 ? (
                <p className="px-1 py-6 text-center text-sm text-muted-foreground">
                  Tidak ada hasil untuk “{term}”.
                </p>
              ) : null}

              {shown.map((g) => (
                <div key={g.module.route} className="mt-3">
                  <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
                    <span className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                      {g.module.label} · {g.total}
                    </span>
                    <button
                      type="button"
                      onClick={() => goToFilter(g)}
                      className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-semibold text-primary"
                    >
                      <Filter className="size-3" />
                      Buka {g.total} data
                    </button>
                  </div>
                  <div className="glass-card rounded-2xl p-1">
                    {g.hits.map((h) => (
                      <HitRow
                        key={`${g.module.route}-${h.id}`}
                        group={g}
                        hit={h}
                        onOpenMenu={() => goToRow(g, h)}
                      />
                    ))}
                    {g.total > g.hits.length ? (
                      <button
                        type="button"
                        onClick={() => goToFilter(g)}
                        className="w-full rounded-xl px-3 py-2 text-left text-xs text-muted-foreground"
                      >
                        +{g.total - g.hits.length} data lain di {g.module.label}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
