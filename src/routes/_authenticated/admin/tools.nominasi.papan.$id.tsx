import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Settings, Sparkles, Star, X } from "lucide-react";

import {
  normalizeBoard,
  type NominasiBoard,
  type NominasiCategory,
  type NominasiNominee,
} from "@/lib/nominasi-ui";
import { getNominasiEvent } from "@/lib/nominasi.functions";

export const Route = createFileRoute("/_authenticated/admin/tools/nominasi/papan/$id")({
  head: () => ({
    meta: [
      { title: "Papan Nominasi — SuperIT Apps" },
      {
        name: "description",
        content: "Papan pengumuman Best Performance: ungkap nominasi satu per satu saat acara.",
      },
      { property: "og:title", content: "Papan Nominasi — SuperIT Apps" },
      {
        property: "og:description",
        content: "Papan pengumuman Best Performance BRI BO Pringsewu.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function NomineeCard({
  n,
  animate,
  size = "md",
}: {
  n: NominasiNominee;
  animate?: boolean;
  size?: "md" | "sm";
}) {
  return (
    <>
      {animate ? (
        <div className="nom-sparks">
          {Array.from({ length: 14 }).map((_, s) => (
            <span
              key={s}
              className="nom-spark"
              style={{
                ["--tx" as string]: `${Math.cos((s / 14) * Math.PI * 2) * 130}px`,
                ["--ty" as string]: `${Math.sin((s / 14) * Math.PI * 2) * 130}px`,
                animationDelay: `${s * 0.04}s`,
              }}
            >
              <Star className="size-4 fill-current drop-shadow-[0_0_8px_currentColor]" />
            </span>
          ))}
        </div>
      ) : null}
      <div className={`nom-frame ${animate ? "is-glow" : ""}`}>
        {n.photo ? (
          <img src={n.photo} alt={n.name} loading="lazy" />
        ) : (
          <div className="nom-frame-empty">Foto</div>
        )}
      </div>
      <div className={`nom-plate ${size === "sm" ? "is-sm" : ""}`}>
        <p className="nom-name">{n.name}</p>
        <p className="nom-position">{n.position}</p>
      </div>
    </>
  );
}

function FinaleOverlay({
  board,
  categories,
  logoSrc,
  logoHeight,
  logo2Src,
  logo2Height,
  onClose,
}: {
  board: NominasiBoard;
  categories: NominasiCategory[];
  logoSrc: string | null;
  logoHeight: number;
  logo2Src: string | null;
  logo2Height: number;
  onClose: () => void;
}) {
  return (
    <div className="nom-stage nom-finale">
      <div className="nom-finale-head">
        {logoSrc ? (
          <img src={logoSrc} alt="Logo utama" style={{ height: `${logoHeight}px` }} />
        ) : (
          <span />
        )}
        <div className="min-w-0 text-center">
          <h2 className="nom-finale-title">{board.heading}</h2>
          <p className="nom-finale-sub">
            [ {board.period} ] — {board.unit}
          </p>
        </div>
        {logo2Src ? (
          <img src={logo2Src} alt="Logo pendukung" style={{ height: `${logo2Height}px` }} />
        ) : (
          <span />
        )}
      </div>

      <div className="nom-finale-body">
        <div className="nom-finale-wrap">
          {categories.map((cat) => {
            const count = cat.nominees.length;
            const cols = Math.min(count > 0 ? count : 1, 6);
            return (
              <section
                key={cat.id}
                className="nom-finale-cat"
                style={{ width: `${cols * 140 + (cols - 1) * 16 + 32}px`, minWidth: "200px" }}
              >
                <h3>
                  <span className="nom-finale-chip">{cat.name}</span>
                </h3>
                {count > 0 ? (
                  <ul
                    className="nom-finale-grid"
                    style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                  >
                    {cat.nominees.map((n) => (
                      <li key={n.id} className="relative min-w-0">
                        <NomineeCard n={n} size="sm" />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="nom-finale-empty">Belum ada nominasi</p>
                )}
              </section>
            );
          })}
        </div>
      </div>

      <p className="nom-finale-tagline">Semangat Baru! Siap Bertransformasi!</p>

      <button
        type="button"
        aria-label="Tutup tampilan semua kategori"
        onClick={onClose}
        className="nom-finale-close"
      >
        <X className="size-5" />
      </button>
    </div>
  );
}

function Page() {
  const { id } = useParams({ from: "/_authenticated/admin/tools/nominasi/papan/$id" });
  const q = useQuery({
    queryKey: ["nominasi-event", id],
    queryFn: () => getNominasiEvent({ data: { id } }),
  });

  const board: NominasiBoard | null = useMemo(
    () => (q.data ? normalizeBoard(q.data.data) : null),
    [q.data],
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  const [revealedMap, setRevealedMap] = useState<Record<string, number>>({});
  const [lastRevealed, setLastRevealed] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setLastRevealed(null);
  }, [activeId]);

  if (q.isLoading || !board) {
    return <div className="p-8 text-sm text-muted-foreground">Memuat papan...</div>;
  }

  const categories = board.categories;
  const active = categories.find((c) => c.id === activeId) ?? categories[0];
  const nominees = active?.nominees ?? [];
  const revealed = active ? (revealedMap[active.id] ?? 0) : 0;
  const done = revealed >= nominees.length;
  const allDone =
    categories.length > 0 &&
    categories.every((c) => (revealedMap[c.id] ?? 0) >= c.nominees.length);

  const logoSrc = board.logo;
  const logoHeight = board.logoHeight;
  const logo2Src = board.logo2;
  const logo2Height = board.logo2Height;

  return (
    <main className="nom-stage">
      <div className="nom-inner">
        <header className="nom-topbar">
          {logoSrc ? (
            <img src={logoSrc} alt="Logo utama" style={{ height: `${logoHeight}px` }} />
          ) : (
            <span />
          )}
          {logo2Src ? (
            <img src={logo2Src} alt="Logo pendukung" style={{ height: `${logo2Height}px` }} />
          ) : (
            <span />
          )}
        </header>

        <section className="nom-hero">
          <h1 className="nom-h1">
            {board.heading}
            <span>{active?.name ?? "—"}</span>
          </h1>
          <p className="nom-period">[ {board.period} ]</p>
        </section>

        <nav className="nom-tabs">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`nom-tab ${cat.id === active?.id ? "is-active" : ""}`}
              onClick={() => {
                setActiveId(cat.id);
                setLastRevealed(null);
              }}
            >
              {cat.name}
            </button>
          ))}
        </nav>

        <div className="nom-body">
          {nominees.length > 0 ? (
            <ul className="nom-list">
              {nominees.map((n, i) => {
                const isShown = i < revealed;
                const isNew = isShown && lastRevealed === n.id;
                return (
                  <li
                    key={n.id}
                    className={`nom-item ${isShown ? (isNew ? "nom-reveal" : "") : "is-hidden"}`}
                  >
                    <NomineeCard n={n} animate={isNew} />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="nom-period">Belum ada nominasi pada kategori ini</p>
          )}
        </div>

        <footer className="nom-footer">
          <p className="nom-tagline">Semangat Baru! Siap Bertransformasi!</p>
          <p className="nom-unit">{board.unit}</p>
        </footer>
      </div>

      <div className="nom-fabs">
        <button
          type="button"
          aria-label="Tampilkan semua kategori dan nominasi"
          disabled={!allDone}
          onClick={() => setShowAll(true)}
          className="nom-fab nom-fab-mid"
        >
          <Sparkles className="size-6 fill-current" />
        </button>
        <button
          type="button"
          aria-label="Tampilkan nominasi berikutnya"
          disabled={done}
          onClick={() => {
            if (!active) return;
            const next = Math.min(revealed + 1, nominees.length);
            setRevealedMap((m) => ({ ...m, [active.id]: next }));
            setLastRevealed(nominees[next - 1]?.id ?? null);
          }}
          className="nom-fab nom-fab-star"
        >
          <Star className="size-6 fill-current" />
        </button>
        <Link
          to="/admin/tools/nominasi/$id"
          params={{ id }}
          aria-label="Buka panel admin"
          className="nom-fab-sm"
        >
          <Settings className="size-4" />
        </Link>
      </div>

      {showAll ? (
        <FinaleOverlay
          board={board}
          categories={categories}
          logoSrc={logoSrc}
          logoHeight={logoHeight}
          logo2Src={logo2Src}
          logo2Height={logo2Height}
          onClose={() => setShowAll(false)}
        />
      ) : null}
    </main>
  );
}
