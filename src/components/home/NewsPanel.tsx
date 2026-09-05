import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Newspaper } from "lucide-react";

import { getNews, type NewsItem } from "@/lib/home-feeds.functions";
import { NewsArticleDialog } from "./NewsArticleDialog";

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
  const items = (q.data ?? []).slice(0, 10);


  const [selected, setSelected] = useState<NewsItem | null>(null);

  return (
    <div className="glass-card flex h-fit flex-col p-5">
      <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-accent uppercase">
        <Newspaper className="size-4" /> Berita
      </p>
      {q.isLoading ? <p className="mt-3 text-sm text-muted-foreground">Memuat berita…</p> : null}
      {!q.isLoading && !items.length ? (
        <p className="mt-3 text-sm text-muted-foreground">Belum ada berita.</p>
      ) : null}
      <ul className="mt-3 space-y-3">
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
