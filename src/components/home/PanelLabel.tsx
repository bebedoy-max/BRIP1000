import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const accents = {
  information: "text-chart-1",
  market: "text-chart-2",
  rates: "text-chart-3",
  events: "text-chart-4",
  news: "text-chart-5",
} as const;

export type PanelLabelAccent = keyof typeof accents;

function splitLabel(label: string): [string, string] {
  const trimmed = label.trim();
  const spaceIdx = trimmed.indexOf(" ");
  if (spaceIdx === -1) {
    const mid = Math.ceil(trimmed.length / 2);
    return [trimmed.slice(0, mid), trimmed.slice(mid)];
  }
  return [trimmed.slice(0, spaceIdx), trimmed.slice(spaceIdx + 1)];
}

export function PanelLabel({
  icon: Icon,
  label,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  accent: PanelLabelAccent;
}) {
  const [first, rest] = splitLabel(label);

  return (
    <div className={cn("relative z-10 mb-3 flex items-center gap-2.5", accents[accent])}>
      <span className="grid size-8 shrink-0 place-items-center rounded-full border border-current/60 bg-transparent">
        <Icon className="size-4 text-current" aria-hidden="true" />
      </span>
      <div className="flex flex-col">
        <h2 className="text-base font-black leading-none tracking-[0.08em] text-foreground uppercase">
          <span className="text-foreground">{first}</span>
          <span className="text-current">{" "}{rest}</span>
        </h2>
        <span
          className="mt-1.5 h-0.5 w-10 bg-current"
          style={{ clipPath: "polygon(0 0, 100% 0, 70% 100%, 0 100%)" }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}