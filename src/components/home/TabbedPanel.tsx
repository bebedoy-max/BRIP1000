import { useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export type PanelTab = {
  key: string;
  label: string;
  icon: LucideIcon;
  content: ReactNode;
};

/**
 * Satu kolom, beberapa panel bertab. Semua isi tab ditumpuk pada sel grid yang sama,
 * sehingga tinggi kolom = tab tertinggi dan tidak melompat saat berganti tab.
 */
export function TabbedPanel({
  tabs,
  className = "",
  fill = true,
}: {
  tabs: PanelTab[];
  className?: string;
  /** true: ikut tinggi sel induk (h-full); false: setinggi isinya (untuk rel flex). */
  fill?: boolean;
}) {
  const [active, setActive] = useState(tabs[0]?.key ?? "");

  return (
    <section
      className={`glass-card flex min-w-0 flex-col p-4 ${fill ? "h-full" : ""} ${className}`}
    >
      <div
        role="tablist"
        className="mb-4 grid shrink-0 gap-1 rounded-full border border-border/60 bg-background/40 p-1"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((t) => {
          const on = active === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActive(t.key)}
              className={`flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-bold tracking-wide uppercase transition-colors ${
                on
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="size-4 shrink-0" />
              <span className="truncate">{t.label}</span>
            </button>
          );
        })}
      </div>

      <div className="grid min-h-0 flex-1 [&>*]:col-start-1 [&>*]:row-start-1">
        {tabs.map((t) => {
          const on = active === t.key;
          return (
            <div
              key={t.key}
              role="tabpanel"
              aria-hidden={!on}
              className={`min-w-0 ${on ? "" : "pointer-events-none invisible"}`}
            >
              {t.content}
            </div>
          );
        })}
      </div>
    </section>
  );
}
