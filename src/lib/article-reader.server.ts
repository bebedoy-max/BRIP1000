import { blocksFromMarkdown, blocksFromPlainText, extractArticle, extractStructured, isUsableArticle } from "./article-extract";
import { resolveGoogleNewsUrl } from "./google-news.server";

type ArticleContent = {
  title: string;
  blocks: { tag: string; text: string }[];
  sourceUrl: string;
};

type ReaderInput = { url: string; headline?: string | undefined; source?: string | undefined };

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const GOOGLEBOT_UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

async function fetchText(url: string, userAgent = BROWSER_UA, timeout = 12_000) {
  const response = await fetch(url, {
    headers: {
      "user-agent": userAgent,
      accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
      "accept-language": "id-ID,id;q=0.9,en;q=0.8",
      referer: "https://news.google.com/",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) return null;
  return response.text();
}

const normalize = (value: string) => value.toLocaleLowerCase("id-ID").replace(/[^a-z0-9]+/g, " ").trim();

/** Situs Tribrata kerap memblokir server, tetapi artikelnya juga diterbitkan
 * pada kanal resmi Polres Blitar Kota. Ambil salinan yang judulnya sama. */
async function readOfficialMirror(sourceUrl: string, headline: string) {
  let hostname = "";
  try {
    hostname = new URL(sourceUrl).hostname;
  } catch {
    return null;
  }
  if (!hostname.includes("tribratanews") || !headline) return null;

  const searchUrl = `https://proklamatornews.com/wp-json/wp/v2/search?search=${encodeURIComponent(headline)}&per_page=10`;
  const raw = await fetchText(searchUrl);
  if (!raw) return null;
  const results = JSON.parse(raw) as { id?: number; title?: string }[];
  const wanted = normalize(headline);
  const match = results.find((item) => item.id && normalize(item.title ?? "") === wanted);
  if (!match?.id) return null;

  const postRaw = await fetchText(`https://proklamatornews.com/wp-json/wp/v2/posts/${match.id}`);
  if (!postRaw) return null;
  const post = JSON.parse(postRaw) as { title?: { rendered?: string }; content?: { rendered?: string } };
  const html = post.content?.rendered ?? "";
  const parsed = extractArticle(`<article><h1>${post.title?.rendered ?? headline}</h1>${html}</article>`);
  return isUsableArticle(parsed.blocks, parsed.title) ? parsed : null;
}

/** Buang penanda halaman dari URL agar dapat URL dasar artikel. */
function stripPageMarkers(input: string): string {
  const u = new URL(input);
  for (const key of ["page", "single", "halaman", "all"]) u.searchParams.delete(key);
  u.hash = "";
  // .../judul-berita/2  atau  .../judul-berita-halaman-3
  u.pathname = u.pathname
    .replace(/\/(?:halaman|page)[-/]?\d{1,2}\/?$/i, "")
    .replace(/\/\d{1,2}\/?$/, "");
  return u.toString();
}

/** Varian URL "tampilkan semua halaman" yang dipakai penerbit Indonesia. */
function showAllCandidates(input: string): string[] {
  try {
    const base = stripPageMarkers(input);
    const withParam = (key: string, value: string) => {
      const u = new URL(base);
      u.searchParams.set(key, value);
      return u.toString();
    };
    return [withParam("page", "all"), withParam("single", "1"), base];
  } catch {
    return [input];
  }
}

/** URL halaman ke-n untuk penerbit yang tidak menyediakan "show all". */
function pageUrl(input: string, page: number): string | null {
  try {
    const u = new URL(stripPageMarkers(input));
    u.searchParams.set("page", String(page));
    return u.toString();
  } catch {
    return null;
  }
}

const cleanTitle = (value: string) =>
  value
    .replace(/\s*[-–|]\s*(?:Semua Halaman|All Pages)\s*$/i, "")
    .replace(/\s*[-–|]\s*(?:Halaman|Page)\s*\d+\s*$/i, "")
    .trim();

/** Gabungkan isi seluruh halaman (halaman 2..maks) bila artikel bersambung. */
async function mergePages(sourceUrl: string, first: ArticleContent["blocks"]) {
  const blocks = [...first];
  const seen = new Set(blocks.map((b) => b.text));
  for (let page = 2; page <= 8; page++) {
    const url = pageUrl(sourceUrl, page);
    if (!url) break;
    let added = 0;
    try {
      const html = await fetchText(url);
      if (!html) break;
      const parsed = extractArticle(html);
      if (!isUsableArticle(parsed.blocks, parsed.title)) break;
      for (const block of parsed.blocks) {
        if (seen.has(block.text)) continue;
        seen.add(block.text);
        blocks.push(block);
        added++;
      }
    } catch {
      break;
    }
    if (!added) break;
  }
  return blocks;
}

export async function readArticle(data: ReaderInput): Promise<ArticleContent> {
  let sourceUrl = data.url;
  let title = "";
  let structuredBlocks: ArticleContent["blocks"] = [];

  try {
    sourceUrl = await resolveGoogleNewsUrl(data.url);
  } catch {
    // URL masukan mungkin sudah merupakan URL penerbit.
  }

  // Prioritaskan versi "seluruh halaman" agar artikel bersambung utuh.
  const [allUrl, singleUrl, baseUrl] = showAllCandidates(sourceUrl);
  const attempts = [
    { url: allUrl ?? sourceUrl, ua: BROWSER_UA, merge: false },
    { url: singleUrl ?? sourceUrl, ua: BROWSER_UA, merge: false },
    { url: baseUrl ?? sourceUrl, ua: BROWSER_UA, merge: true },
    { url: sourceUrl, ua: BROWSER_UA, merge: true },
    { url: sourceUrl, ua: GOOGLEBOT_UA, merge: true },
    { url: sourceUrl.replace(/\/?$/, "/amp"), ua: BROWSER_UA, merge: false },
  ];

  for (const attempt of attempts) {
    try {
      const html = await fetchText(attempt.url, attempt.ua);
      if (!html) continue;
      const parsed = extractArticle(html);
      title = cleanTitle(parsed.title) || title;
      if (isUsableArticle(parsed.blocks, parsed.title)) {
        const blocks = attempt.merge
          ? await mergePages(attempt.url, parsed.blocks)
          : parsed.blocks;
        return { title, blocks, sourceUrl: attempt.url };
      }

      if (structuredBlocks.length === 0) {
        const meta = extractStructured(html);
        title = title || cleanTitle(meta.title);
        const body = blocksFromPlainText(meta.body);
        structuredBlocks = body.length ? body : blocksFromPlainText(meta.description);
      }
    } catch {
      // Coba mode pembaca berikutnya.
    }
  }

  // Penerbit yang memblokir permintaan server: coba lewat proxy pembaca publik.
  for (const proxy of [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(sourceUrl)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(sourceUrl)}`,
  ]) {
    try {
      const html = await fetchText(proxy, BROWSER_UA, 15_000);
      if (!html) continue;
      const parsed = extractArticle(html);
      title = cleanTitle(parsed.title) || title;
      if (isUsableArticle(parsed.blocks, parsed.title)) {
        return { title, blocks: parsed.blocks, sourceUrl };
      }
      if (structuredBlocks.length === 0) {
        const meta = extractStructured(html);
        title = title || cleanTitle(meta.title);
        const body = blocksFromPlainText(meta.body);
        structuredBlocks = body.length ? body : blocksFromPlainText(meta.description);
      }
    } catch {
      // Coba proxy berikutnya.
    }
  }

  try {
    const response = await fetch(`https://r.jina.ai/${sourceUrl}`, {
      headers: { "user-agent": BROWSER_UA, accept: "text/plain", "x-return-format": "markdown" },
      signal: AbortSignal.timeout(15_000),
    });
    if (response.ok) {
      const markdown = await response.text();
      const markdownTitle = /^Title:\s*(.+)$/m.exec(markdown)?.[1]?.trim() ?? "";
      const body = markdown.replace(/^[\s\S]*?Markdown Content:\s*/, "");
      const blocks = blocksFromMarkdown(body, markdownTitle || title);
      if (isUsableArticle(blocks, markdownTitle || title)) {
        return { title: title || markdownTitle, blocks, sourceUrl };
      }
    }
  } catch {
    // Coba salinan resmi berikutnya.
  }

  try {
    const mirrored = await readOfficialMirror(sourceUrl, data.headline ?? title);
    if (mirrored) return { title: mirrored.title || data.headline || title, blocks: mirrored.blocks, sourceUrl };
  } catch {
    // Tidak ada salinan resmi yang cocok.
  }

  if (structuredBlocks.length) return { title: title || data.headline || "", blocks: structuredBlocks, sourceUrl };

  return { title: data.headline || title, blocks: [], sourceUrl };
}