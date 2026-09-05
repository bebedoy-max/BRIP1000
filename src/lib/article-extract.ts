import { parse } from "node-html-parser";

export type ArticleBlocks = { tag: string; text: string }[];

const NOISE_SELECTORS = [
  "script",
  "style",
  "nav",
  "header",
  "footer",
  "aside",
  "noscript",
  "iframe",
  "form",
  "button",
  "svg",
  "figcaption",
  "advertisement",
  ".ads",
  ".advertisement",
  ".social-share",
  ".related-posts",
  ".comments",
  ".readother",
  ".read-other",
  ".read-also",
  // blok "Baca Juga", tag, rekomendasi, dan sisipan promosi penerbit
  "[class*='baca']",
  "[class*='related']",
  "[class*='terkait']",
  "[class*='share']",
  "[class*='tag']",
  "[class*='recommend']",
  "[class*='popular']",
  "[class*='newsletter']",
  "[class*='subscribe']",
  "[id*='baca']",
  "[id*='related']",
  "table",
  "ul",
  "ol",
];

/** Kalimat/label sampah yang sering menempel di isi artikel. */
const JUNK_PATTERNS: RegExp[] = [
  /\bbaca\s*(juga|selengkapnya)\s*:/i,
  /^baca\s*(juga|selengkapnya)/i,
  /^cek berita dan artikel (yang )?lain/i,
  /^lihat\s*juga/i,
  /^simak\s*(juga|video)/i,
  /^(artikel\s*)?terkait$/i,
  /^lainnya$/i,
  /^topik(\s*terkait)?:?/i,
  /^tag(s)?\s*:/i,
  /^(bagikan|share|kirim)\b/i,
  /^(iklan|advertisement)$/i,
  /^(editor|reporter|penulis|kontributor|sumber)\s*:/i,
  /^copyright\b/i,
  /^(halaman|page)\s*\d+$/i,
  /^(selanjutnya|sebelumnya|next|prev)$/i,
  /^(berita|video|foto|infografis)\s*(terbaru|populer|pilihan)/i,
  /^(ikuti|follow)\s+(kami|berita)/i,
  /(langganan|berlangganan)\s+(kompas|newsletter)/i,
  /^(bank bri|bri finance|bri multifinance indonesia(?: \(bri finance\))?)$/i,
  /^(nasional|keuangan|investasi|industri|internasional|peluang usaha|personal finance|english|lifestyle|fokus|regional|yang ter|kesehatan|cari tahu|analisis|executive|kolom|insight|kontan tv|market|reksadana|unitlink|bunga deposito|ekonomi makro|konten kerjasama|kilas|native|advertorial)$/i,
  /^(setelan perangkat|login untuk|continue with google|terima kasih telah menjadi bagian)/i,
  /cloudflare|why have i been blocked|what can i do to resolve this|security service to protect itself/i,
  /^\(?(ant|antara|dtc|detikcom|red|adv)\)?$/i,
];

const isJunk = (text: string) => JUNK_PATTERNS.some((re) => re.test(text));

const STOP_PATTERNS: RegExp[] = [
  /^baca\s*(juga|selengkapnya)/i,
  /^cek berita dan artikel (yang )?lain/i,
  /^(berita|artikel)\s+(terkini|terbaru|terpopuler|pilihan)/i,
  /^(berita|artikel)\s+lainnya/i,
  /^rekomendasi( untuk anda)?$/i,
];

const isStopMarker = (text: string) => STOP_PATTERNS.some((re) => re.test(text));

export function isUsableArticle(blocks: ArticleBlocks, title = "") {
  const combined = `${title} ${blocks.map((block) => block.text).join(" ")}`;
  if (/cloudflare|attention required|why have i been blocked|captcha/i.test(combined)) return false;
  return blocks.filter((block) => block.tag === "p").length >= 2;
}


const CONTENT_SELECTORS = [
  ".news-text",
  ".article__body",
  ".post-single-content",
  ".entry-content.clearfix",
  "article",
  "[role='main']",
  "main",
  ".entry-content",
  ".post-content",
  ".article-content",
  ".article-body",
  ".content",
  ".detail__body-text",
  ".read__content",
  ".media-body",
  ".main-content",
  "#content",
  ".detail-text",
  ".text-detail",
];

export function extractArticle(html: string) {
  const root = parse(html);

  for (const sel of NOISE_SELECTORS) {
    root.querySelectorAll(sel).forEach((el) => el.remove());
  }

  let container: ReturnType<typeof root.querySelector> = null;
  for (const sel of CONTENT_SELECTORS) {
    container = root.querySelector(sel);
    if (container) break;
  }
  if (!container) container = root.querySelector("body") ?? root;

  const title =
    root.querySelector("meta[property='og:title']")?.getAttribute("content")?.trim() ||
    root.querySelector("title")?.text?.trim() ||
    root.querySelector("h1")?.text?.trim() ||
    "";

  const nodes = container.querySelectorAll("h2, h3, h4, p");
  const blocks: ArticleBlocks = [];
  const seen = new Set<string>();

  for (const node of nodes) {
    const tag = node.tagName.toLowerCase();
    // Sejumlah penerbit (mis. MetroTV) menaruh seluruh artikel dalam satu <p>
    // dan memakai <br><br> sebagai pemisah paragraf. Pecah sebelum membaca teks.
    const pieces = tag === "p"
      ? node.innerHTML.split(/(?:\s*<br\s*\/?>\s*){2,}/i)
      : [node.innerHTML];

    for (const piece of pieces) {
      const text = parse(`<div>${piece}</div>`).text.trim().replace(/\s+/g, " ");
      if (!text) continue;
      // Marker hanya membuang blok itu sendiri. Jangan hentikan artikel karena
      // "Baca Juga" sering disisipkan di tengah isi utama.
      if (isStopMarker(text)) continue;
      if (text === title || isJunk(text)) continue;
      if (tag === "p" && text.length < 40) continue;
      if (tag !== "p" && text.length < 12) continue;
      if (seen.has(text)) continue;
      seen.add(text);
      blocks.push({ tag, text });
    }
  }

  // Hapus heading yang tidak diikuti paragraf (sisa blok rekomendasi).
  const cleaned = blocks.filter((b, i) => b.tag === "p" || blocks[i + 1]?.tag === "p");

  if (cleaned.length === 0) {
    const fallback = container.text.trim().replace(/\s+/g, " ");
    if (fallback.length > 120) cleaned.push({ tag: "p", text: fallback });
  }

  return { title, blocks: cleaned };
}

/** Ubah markdown (fallback pembaca teks) menjadi blok artikel. */
export function blocksFromMarkdown(markdown: string, title: string): ArticleBlocks {
  const blocks: ArticleBlocks = [];
  const seen = new Set<string>();
  for (const rawLine of markdown.split(/\n{2,}|\n(?=#{1,6}\s)/)) {
    let text = rawLine
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[*_`>]+/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;
    const heading = /^#{1,6}\s+/.test(text);
    text = text.replace(/^#{1,6}\s+/, "").replace(/^[-•]\s*/, "").trim();
    if (isStopMarker(text)) {
      // Jangan berhenti sebelum artikel dimulai; halaman hasil reader sering
      // menaruh navigasi di bagian atas. Setelah isi ditemukan, sisanya noise.
      if (blocks.filter((block) => block.tag === "p").length >= 2) break;
      continue;
    }
    if (!text || text === title || isJunk(text)) continue;
    if (!heading && text.length < 40) continue;
    if (heading && text.length < 12) continue;
    if (seen.has(text)) continue;
    seen.add(text);
    blocks.push({ tag: heading ? "h3" : "p", text });
  }
  const cleaned = blocks.filter((b, i) => b.tag === "p" || blocks[i + 1]?.tag === "p");
  if (!isUsableArticle(cleaned, title)) return [];
  return cleaned;
}


/** Isi/ringkasan resmi dari data terstruktur (JSON-LD schema.org) atau meta tag. */
export function extractStructured(html: string): { title: string; body: string; description: string } {
  let title = "";
  let body = "";
  let description = "";

  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    if (typeof obj["articleBody"] === "string" && obj["articleBody"].length > body.length) {
      body = obj["articleBody"];
    }
    if (typeof obj["description"] === "string" && obj["description"].length > description.length) {
      description = obj["description"];
    }
    if (!title && typeof obj["headline"] === "string") title = obj["headline"];
    if (!title && typeof obj["name"] === "string") title = obj["name"];
    Object.values(obj).forEach(walk);
  };

  for (const m of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      walk(JSON.parse((m[1] ?? "").trim()));
    } catch {
      /* lewati JSON-LD rusak */
    }
  }

  if (!description) {
    description =
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i.exec(html)?.[1] ??
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i.exec(html)?.[1] ??
      "";
  }

  const decode = (s: string) =>
    s
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;|&apos;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/&nbsp;/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim();

  return { title: decode(title), body: decode(body), description: decode(description) };
}

/** Blok artikel dari teks polos (articleBody / deskripsi penerbit). */
export function blocksFromPlainText(text: string): ArticleBlocks {
  const parts = text
    .replace(/<[^>]+>/g, " ")
    .split(/\n{1,}|(?<=[.!?])\s{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 40 && !isJunk(p) && !isStopMarker(p));
  const seen = new Set<string>();
  return parts.filter((p) => !seen.has(p) && seen.add(p)).map((p) => ({ tag: "p", text: p }));
}
