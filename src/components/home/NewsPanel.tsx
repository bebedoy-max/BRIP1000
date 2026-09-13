import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Newspaper } from "lucide-react";

import { getNews, NEWS_CATEGORIES, type NewsCategory, type NewsItem } from "@/lib/home-feeds.functions";
import { Button } from "@/components/ui/button";
import { NewsArticleDialog } from "./NewsArticleDialog";
import { PanelLabel } from "./PanelLabel";

const THREE_HOURS = 3 * 60 * 60 * 1000;

/** Format tanggal & jam dalam Waktu Indonesia Barat. */
function formatWib(date: string) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  })} WIB`;
}

/** Panel berita perbankan, bisnis & keuangan (refresh tiap 3 jam). */
export function NewsPanel() {
  const q = useQuery({
    queryKey: ["home-news"],
    queryFn: () => getNews(),
    staleTime: THREE_HOURS,
    refetchInterval: THREE_HOURS,
    refetchIntervalInBackground: true,
    retry: 2,
    placeholderData: (prev) => prev,
  });
  const [activeCategory, setActiveCategory] = useState<NewsCategory>("Nasional");
  const [selected, setSelected] = useState<NewsItem | null>(null);
  const items = q.data?.[activeCategory] ?? [];

  return (
    <div className="glass-card flex h-fit flex-col p-5">
      <PanelLabel icon={Newspaper} label="Berita" accent="news" />
      <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg border border-border/60 bg-background/35 p-1 sm:grid-cols-5" role="tablist" aria-label="Kategori berita">
        {NEWS_CATEGORIES.map((category) => (
          <Button
            key={category}
            type="button"
            role="tab"
            size="sm"
            variant={activeCategory === category ? "default" : "ghost"}
            aria-selected={activeCategory === category}
            onClick={() => setActiveCategory(category)}
            className="h-7 min-w-0 px-1 text-[10px] sm:text-[11px]"
          >
            {category}
          </Button>
        ))}
      </div>
      {q.isLoading ? <p className="mt-3 text-sm text-muted-foreground">Memuat berita…</p> : null}
      {!q.isLoading && !items.length ? (
        <p className="mt-3 text-sm text-muted-foreground">Belum ada berita.</p>
      ) : null}
      <ul className="mt-3 space-y-3" role="tabpanel" aria-label={`Berita ${activeCategory}`}>
        {items.map((n) => (
          <li key={n.link} className="border-b border-border/50 pb-2 last:border-0">
            <button
              type="button"
              onClick={() => setSelected(n)}
              className="line-clamp-2 text-left text-sm font-medium transition-colors hover:text-accent"
            >
              {n.title}
            </button>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {n.source}
              {n.date ? ` · ${formatWib(n.date)}` : ""}
            </p>
          </li>
        ))}
      </ul>

      <NewsArticleDialog item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
