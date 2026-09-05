import type { LucideIcon } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";

export type StatCardProps = {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  /** Bila diisi, kartu menjadi tautan ke halaman detail /detail/$key. */
  detailKey?: string;
};

export function StatCard({ label, value, icon: Icon, hint, detailKey }: StatCardProps) {
  const fromPath = useRouterState({ select: (st) => st.location.pathname });

  const body = (
    <>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </p>
        <p className="mt-1 text-3xl font-bold text-foreground tabular-nums">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <div
        className="grid size-12 shrink-0 place-items-center rounded-2xl"
        style={{ backgroundImage: "var(--gradient-stat)", boxShadow: "var(--shadow-glow)" }}
      >
        <Icon className="size-5 text-primary-foreground" />
      </div>
    </>
  );

  const base = "glass-card flex items-center justify-between gap-4 p-5";

  if (!detailKey) return <div className={base}>{body}</div>;

  return (
    <Link
      to="/detail/$key"
      params={{ key: detailKey }}
      search={{ from: fromPath }}
      aria-label={`Lihat detail ${label}`}
      className={`${base} cursor-pointer transition-transform duration-200 hover:-translate-y-0.5 hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none`}
    >
      {body}
    </Link>
  );
}
