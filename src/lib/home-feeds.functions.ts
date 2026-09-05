import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type MarketQuote = {
  key: string;
  label: string;
  value: string;
  change: number | null;
  unit: string;
};

const SYMBOLS: { key: string; symbol: string; label: string; unit: string }[] = [
  { key: "bbri", symbol: "BBRI.JK", label: "Saham BBRI", unit: "IDR" },
  { key: "usdidr", symbol: "IDR=X", label: "Kurs USD/IDR", unit: "IDR" },
  { key: "xau", symbol: "GC=F", label: "Emas (XAU)", unit: "IDR/gr" },
];

const OZ_TO_GRAM = 31.1034768; // 1 troy ounce = 31,1035 gram

async function fetchPrice(symbol: string): Promise<{ price: number; prev: number | null } | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`,
      { headers: { "user-agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(6000) },
    );
    const json = (await res.json()) as {
      chart?: {
        result?: {
          meta?: { regularMarketPrice?: number; chartPreviousClose?: number; previousClose?: number };
        }[];
      };
    };
    const meta = json.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    if (typeof price !== "number") return null;
    const prev = meta?.chartPreviousClose ?? meta?.previousClose ?? null;
    return { price, prev };
  } catch {
    return null;
  }
}

/** Kutipan pasar (Yahoo Finance chart API, tanpa API key). Emas dikonversi ke IDR per gram. */
export const getMarketQuotes = createServerFn({ method: "GET" }).handler(async () => {
  const out: MarketQuote[] = [];
  let usdIdr: number | null = null;
  for (const s of SYMBOLS) {
    const q = await fetchPrice(s.symbol);
    if (!q) continue;
    let price = q.price;
    let prev = q.prev;
    if (s.key === "usdidr") usdIdr = price;
    if (s.key === "xau") {
      const rate = usdIdr ?? (await fetchPrice("IDR=X"))?.price ?? null;
      if (!rate || rate <= 0) continue;
      price = (price / OZ_TO_GRAM) * rate;
      prev = prev ? (prev / OZ_TO_GRAM) * rate : null;
    }
    out.push({
      key: s.key,
      label: s.label,
      unit: s.unit,
      value: price.toLocaleString("id-ID", { maximumFractionDigits: s.key === "xau" ? 0 : 2 }),
      change: prev && prev > 0 ? ((price - prev) / prev) * 100 : null,
    });
  }
  return out;
});

export type ArticleContent = {
  title: string;
  blocks: { tag: string; text: string }[];
  sourceUrl: string;
};

/** Ambil isi artikel dari URL untuk ditampilkan dalam pop-up bacaan. */
export const getArticleContent = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ url: z.string().url(), headline: z.string().trim().max(500).optional(), source: z.string().trim().max(100).optional() }).parse(data),
  )
  .handler(async ({ data }): Promise<ArticleContent> => {
    const { readArticle } = await import("./article-reader.server");
    return readArticle(data);
  });





export type NewsItem = { title: string; link: string; date: string | null; source: string };

const pick = (xml: string, tag: string) => {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(xml);
  if (!m?.[1]) return "";
  return m[1]
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]+>/g, "")
    .trim();
};

/** Topik berita: perbankan & teknologi perbankan BRI, bisnis/keuangan, kebijakan BI/OJK, fintech global. */
const NEWS_QUERIES = [
  'when:7d ("Bank BRI" OR BBRI) (perbankan OR digital OR teknologi)',
  "when:7d (Bank Indonesia OR OJK) kebijakan perbankan",
  "when:3d berita bisnis keuangan Indonesia terkini",
  "when:2d ekonomi Indonesia trending hari ini",
  "when:3d fintech OR digital banking technology",
];

/** Cadangan topik umum bila kueri utama sepi. */
const FALLBACK_QUERIES = [
  "when:2d berita terkini Indonesia",
  "when:2d pasar saham IHSG rupiah",
];

async function fetchGoogleNews(query: string, limit: number): Promise<NewsItem[]> {
  try {
    const res = await fetch(
      `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=id&gl=ID&ceid=ID:id`,
      { signal: AbortSignal.timeout(7000) },
    );
    if (!res.ok) return [];
    const xml = await res.text();
    return xml
      .split("<item>")
      .slice(1, limit + 1)
      .map((raw): NewsItem => {
        const title = pick(raw, "title");
        const source = pick(raw, "source") || "Google News";
        return {
          title: title.replace(new RegExp(` - ${source}$`), ""),
          link: pick(raw, "link"),
          date: pick(raw, "pubDate") || null,
          source,
        };
      })
      .filter((n) => n.title && n.link);
  } catch {
    return [];
  }
}

function mergeUnique(lists: NewsItem[][]): NewsItem[] {
  const seen = new Set<string>();
  const merged: NewsItem[] = [];
  for (const item of lists.flat()) {
    const key = item.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  merged.sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime());
  return merged;
}

const NEWS_TARGET = 10;

/** Berita perbankan, bisnis, keuangan & fintech — minimal 10 item, diutamakan yang isinya terbaca. */
export const getNews = createServerFn({ method: "GET" }).handler(async () => {
  let merged = mergeUnique(await Promise.all(NEWS_QUERIES.map((q) => fetchGoogleNews(q, 12))));
  if (merged.length < NEWS_TARGET * 2) {
    const extra = await Promise.all(FALLBACK_QUERIES.map((q) => fetchGoogleNews(q, 12)));
    merged = mergeUnique([merged, ...extra]);
  }

  const { keepReadableCached } = await import("./news-readable.server");
  return keepReadableCached(merged.slice(0, 40), 12);
});


/** Suku bunga Deposito & Giro BRI (cache 6 jam di server). */
export const getBankRates = createServerFn({ method: "GET" }).handler(async () => {
  const { getBankRates: load } = await import("./bank-rates.server");
  return load();
});

export type PublicWinner = { category: string; name: string; position: string; photo: string | null };

/** Pemenang (nominee pertama tiap kategori) dari acara nominasi terbaru — untuk dashboard umum. */
export const getPublicNominasiWinners = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { listEvents, getEvent } = await import("@/lib/nominasi.server");
    const events = (await listEvents()) as { id: string; nama_acara?: string }[];
    const first = events?.[0];
    if (!first) return null;
    const ev = await getEvent(first.id);
    const cats = (ev.data?.categories ?? []) as {
      name: string;
      nominees: { name: string; position: string; photo: string | null }[];
    }[];
    const winners: PublicWinner[] = cats
      .filter((c) => c.nominees?.[0])
      .slice(0, 4)
      .map((c) => ({
        category: c.name,
        name: c.nominees[0]!.name,
        position: c.nominees[0]!.position,
        photo: c.nominees[0]!.photo ?? null,
      }));
    return { title: ev.namaAcara ?? "Best Performance", winners };
  } catch {
    return null;
  }
});
