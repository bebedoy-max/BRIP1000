import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { formatDateID } from "@/lib/absensi-ui";
import {
  rankNominees,
  voteInitials,
  type VoteCategory,
  type VoteNominee,
  type VoteResultRow,
  type VoteSettings,
} from "@/lib/vote-ui";
import { getVoteShowcase } from "@/lib/vote.functions";

export const Route = createFileRoute("/vote-show/$slug")({
  head: () => ({
    meta: [
      { title: "Pengumuman Pemenang Vote — BRI BO Pringsewu" },
      {
        name: "description",
        content:
          "Dashboard pengumuman pemenang voting apresiasi pekerja BRI Branch Office Pringsewu lengkap dengan perolehan suara.",
      },
      { property: "og:title", content: "Pengumuman Pemenang Vote — BRI BO Pringsewu" },
      {
        property: "og:description",
        content: "Layar pengumuman pemenang apresiasi pekerja BRI BO Pringsewu.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

type Ranked = VoteNominee & { total: number };

function CrownIcon() {
  return (
    <svg viewBox="0 0 64 44" aria-hidden="true">
      <path d="M4 40h56l-4-28-14 11L32 4 22 23 8 12 4 40Z" />
      <rect x="4" y="38" width="56" height="6" rx="2" />
    </svg>
  );
}

function Confetti({ front, colors }: { front?: boolean; colors: string[] }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: front ? 26 : 60 }, (_, i) => {
        const shape = i % 3 === 0 ? "vs-round" : i % 4 === 0 ? "vs-ribbon" : "";
        return {
          id: i,
          shape,
          style: {
            left: `${Math.random() * 100}%`,
            background: colors[i % colors.length],
            animationDuration: `${5 + Math.random() * 6}s`,
            animationDelay: `${-Math.random() * 8}s`,
            ["--rot" as string]: `${Math.random() * 360}deg`,
            ["--drift" as string]: `${Math.random() * 90 - 45}px`,
            ["--scale" as string]: `${0.7 + Math.random() * 0.8}`,
          } as React.CSSProperties,
        };
      }),
    [front, colors],
  );
  return (
    <div className={`vs-confetti${front ? " vs-confetti-front" : ""}`} aria-hidden="true">
      {pieces.map((p) => (
        <i key={p.id} className={`vs-piece ${p.shape}`} style={p.style} />
      ))}
    </div>
  );
}

function Avatar({
  nominee,
  color,
  className,
}: {
  nominee: { nama: string; foto: string | null };
  color: string;
  className: string;
}) {
  if (nominee.foto) return <img src={nominee.foto} alt={nominee.nama} className={className} />;
  return (
    <div className={className} style={{ background: color }}>
      {voteInitials(nominee.nama)}
    </div>
  );
}

/** Overlay undian: kartu nominasi berputar acak sebelum pemenang muncul. */
function SpinOverlay({
  list,
  color,
  onDone,
}: {
  list: Ranked[];
  color: string;
  onDone: () => void;
}) {
  const [tick, setTick] = useState(0);
  const [fade, setFade] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    const iv = window.setInterval(() => setTick((t) => t + 1), 80);
    const fadeT = window.setTimeout(() => setFade(true), 4200);
    const endT = window.setTimeout(() => {
      if (!done.current) {
        done.current = true;
        onDone();
      }
    }, 5000);
    return () => {
      window.clearInterval(iv);
      window.clearTimeout(fadeT);
      window.clearTimeout(endT);
    };
  }, [onDone]);

  const shown = list.slice(0, 12);
  return (
    <div
      className={`vs-spin${fade ? " vs-fade-out" : ""}`}
      style={{ ["--glow" as string]: color }}
    >
      <p className="vs-spin-title">Mengundi pemenang...</p>
      <div className="vs-spin-stage">
        <span
          className="vs-spin-flash"
          style={{
            ["--fx" as string]: `${(tick * 37) % 100}%`,
            ["--fy" as string]: `${(tick * 61) % 100}%`,
          }}
        />
        {shown.map((n, i) => {
          const t = tick * 0.55 + i * ((Math.PI * 2) / shown.length);
          const radius = 30 + Math.sin(tick * 0.23 + i) * 9;
          const x = Math.cos(t) * radius;
          const y = Math.sin(t * 1.7) * (radius * 0.5);
          const scale = 0.75 + (Math.sin(t * 1.3) + 1) * 0.22;
          const spin = Math.sin(t * 0.8) * 22;
          return (
            <div
              key={n.id}
              className="vs-spin-card"
              style={{
                transform: `translate(${x}vw, ${y}vh) scale(${scale}) rotate(${spin}deg)`,
              }}
            >
              {n.foto ? (
                <img src={n.foto} alt={n.nama} />
              ) : (
                <div className="vs-ph" style={{ background: color }}>
                  {voteInitials(n.nama)}
                </div>
              )}
              <p>{n.nama}</p>
            </div>
          );
        })}
      </div>
    </div>
  );

}

function Page() {
  const { slug } = Route.useParams();
  const [cat, setCat] = useState<VoteCategory | null>(null);
  const [view, setView] = useState<"home" | "list" | "winner" | "standings">("home");
  const [spinning, setSpinning] = useState(false);

  const q = useQuery({
    queryKey: ["vote-showcase", slug],
    queryFn: () => getVoteShowcase({ data: { slug } }),
    refetchInterval: 20_000,
  });

  const settings = (q.data?.settings ?? null) as VoteSettings | null;
  const nominees = (q.data?.nominees ?? []) as VoteNominee[];
  const results = (q.data?.results ?? []) as VoteResultRow[];
  const accent = settings?.accent ?? "#a855f7";
  const categories = settings?.categories ?? [];

  const ranked: Ranked[] = useMemo(
    () => (cat ? rankNominees(nominees, results, cat.name) : []),
    [cat, nominees, results],
  );
  const winner = ranked[0] ?? null;
  const maxVote = Math.max(1, ...ranked.map((r) => r.total));
  const color = cat?.color ?? accent;

  if (q.isLoading) {
    return (
      <main className="vote-show">
        <div className="vs-view">
          <p className="text-sm opacity-70">Memuat dashboard...</p>
        </div>
      </main>
    );
  }
  if (!settings) {
    return (
      <main className="vote-show">
        <div className="vs-view">
          <p className="text-sm opacity-80">Vote event tidak ditemukan atau sudah dihapus.</p>
        </div>
      </main>
    );
  }

  function openCategory(c: VoteCategory) {
    setCat(c);
    setView("list");
  }

  function back(to: "home" | "list") {
    setView(to);
    if (to === "home") setCat(null);
  }

  return (
    <main
      className="vote-show"
      style={{
        ["--glow" as string]: color,
        ["--vs-accent" as string]: accent,
        background: `radial-gradient(ellipse at top left, ${accent}33 0%, #150e23 55%)`,
      }}
    >
      {spinning && cat ? (
        <SpinOverlay
          list={ranked}
          color={color}
          onDone={() => {
            setSpinning(false);
            setView("winner");
          }}
        />
      ) : null}

      {/* ------------------------------- kategori ------------------------------ */}
      {view === "home" ? (
        <div className="vs-view">
          <div
            className="vs-hero vs-hero-center"
            style={{
              background: `linear-gradient(120deg, #3b1660 0%, ${accent} 55%, #d6469f 100%)`,
            }}
          >
            <p className="vs-eyebrow">{settings.eyebrow}</p>
            <h1>
              {settings.title}
              <span className="vs-subtitle">{settings.subtitle}</span>
            </h1>
            <p>
              {settings.showcaseNote} · {formatDateID(settings.eventDate)}
            </p>
          </div>
          <h2 className="vs-title">Kategori Penghargaan</h2>
          <div className="vs-cat-grid">
            {categories.map((c) => {
              const jml = nominees.filter((n) => n.category === c.name).length;
              return (
                <button
                  key={c.name}
                  type="button"
                  className="vs-cat-card"
                  style={{ ["--glow" as string]: c.color }}
                  onClick={() => openCategory(c)}
                >
                  <div className="vs-cat-icon" style={{ background: c.color }}>
                    {c.icon}
                  </div>
                  <h3>{c.name}</h3>
                  <p>{jml} nominasi</p>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* ------------------------------- nominasi ------------------------------ */}
      {view === "list" && cat ? (
        <div className="vs-view">
          <p className="vs-breadcrumb">
            <button type="button" onClick={() => back("home")}>
              Kategori
            </button>{" "}
            / {cat.name}
          </p>
          <h2 className="vs-title">
            <span>{cat.icon}</span> {cat.name}{" "}
            <span className="vs-pill">{ranked.length} nominasi</span>
          </h2>
          <div className="vs-row">
            {ranked.map((n) => (
              <div key={n.id} className="vs-nominee" style={{ ["--glow" as string]: cat.color }}>
                <div className="vs-avatar-frame">
                  <span className="vs-gold-ring" />
                  <Avatar nominee={n} color={cat.color} className="vs-avatar" />
                </div>
                <div>
                  <p className="vs-name">{n.nama}</p>
                  <p className="vs-sub">{[n.jabatan, n.uker].filter(Boolean).join(" · ") || "-"}</p>
                </div>
              </div>
            ))}
            {ranked.length === 0 ? <p className="vs-sub">Belum ada nominasi.</p> : null}
          </div>
          {ranked.length > 0 ? (
            <button
              type="button"
              className="vs-shiny"
              style={{ ["--glow" as string]: cat.color }}
              onClick={() => setSpinning(true)}
            >
              <span className="vs-sheen" />
              <span className="vs-label">✨ Umumkan Pemenang {cat.name}</span>
            </button>
          ) : null}
        </div>
      ) : null}

      {/* -------------------------------- pemenang ------------------------------ */}
      {view === "winner" && cat && winner ? (
        <div className="vs-view">
          <p className="vs-breadcrumb">
            <button type="button" onClick={() => back("list")}>
              {cat.name}
            </button>{" "}
            / Pemenang
          </p>
          <div className="vs-stage vs-fade-in">
            <Confetti colors={[cat.color, "#fbbf24", "#ec4899", "#22d3ee", "#f1edf9"]} />
            <div className="vs-portrait" style={{ ["--glow" as string]: cat.color }}>
              <span className="vs-cat-badge" style={{ background: cat.color }}>
                {cat.icon} {cat.name}
              </span>
              <div className="vs-photo-wrap">
                <span className="vs-crown">
                  <CrownIcon />
                </span>
                <Avatar nominee={winner} color={cat.color} className="vs-photo" />
              </div>
              <span className="vs-winner-tag">🏆 PEMENANG · {winner.total} SUARA</span>
              <h2>{winner.nama}</h2>
              <div className="vs-prow">
                <span className="vs-l">Jabatan</span>
                <span className="vs-v">{winner.jabatan || "-"}</span>
              </div>
              <div className="vs-prow">
                <span className="vs-l">Unit Kerja</span>
                <span className="vs-v">{winner.uker || "-"}</span>
              </div>
              <button
                type="button"
                className="vs-shiny"
                style={{ ["--glow" as string]: cat.color }}
                onClick={() => setView("standings")}
              >
                <span className="vs-sheen" />
                <span className="vs-label">📊 Lihat Perolehan Suara</span>
              </button>
            </div>
            <Confetti front colors={[cat.color, "#fbbf24", "#fde68a"]} />
          </div>
        </div>
      ) : null}

      {/* ------------------------------- perolehan ------------------------------ */}
      {view === "standings" && cat ? (
        <div className="vs-view">
          <p className="vs-breadcrumb">
            <button type="button" onClick={() => back("list")}>
              {cat.name}
            </button>{" "}
            / Perolehan Suara
          </p>
          <h2 className="vs-title">
            <span>{cat.icon}</span> Perolehan Suara {cat.name}
          </h2>
          <div className="vs-podium">
            {[1, 0, 2].map((idx) => {
              const n = ranked[idx];
              if (!n)
                return <div key={idx} className="vs-podium-card vs-empty" aria-hidden="true" />;
              return (
                <div key={n.id} className={`vs-podium-card vs-rank-${idx + 1}`}>
                  <span className="vs-rank-badge">{idx + 1}</span>
                  {idx === 0 ? (
                    <span className="vs-podium-crown">
                      <CrownIcon />
                    </span>
                  ) : null}
                  <Avatar nominee={n} color={cat.color} className="vs-podium-photo" />
                  <p className="vs-podium-name">{n.nama}</p>
                  <p className="vs-sub">{n.jabatan || "-"}</p>
                  <p className="vs-podium-votes">
                    {n.total} <span>suara</span>
                  </p>
                  <div className="vs-bar">
                    <span style={{ width: `${(n.total / maxVote) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          {ranked.slice(3).map((n, i) => (
            <div key={n.id} className="vs-standing">
              <span className="vs-rank-badge" style={{ position: "static" }}>
                {i + 4}
              </span>
              <Avatar nominee={n} color={cat.color} className="vs-standing-photo" />
              <div className="vs-standing-info">
                <p className="vs-name">{n.nama}</p>
                <div className="vs-bar">
                  <span style={{ width: `${(n.total / maxVote) * 100}%` }} />
                </div>
              </div>
              <span className="vs-standing-votes">{n.total} suara</span>
            </div>
          ))}
          <button
            type="button"
            className="vs-shiny"
            style={{ ["--glow" as string]: cat.color }}
            onClick={() => back("home")}
          >
            <span className="vs-sheen" />
            <span className="vs-label">⬅ Kembali ke Kategori</span>
          </button>
        </div>
      ) : null}
    </main>
  );
}
