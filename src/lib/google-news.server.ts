/**
 * Google News RSS memberi link ke halaman redirect (news.google.com/rss/articles/...),
 * bukan langsung ke artikel penerbit. Modul ini mengubah link redirect itu
 * menjadi URL artikel asli.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export const isGoogleNewsUrl = (url: string) => /(^|\.)news\.google\.com$/i.test(safeHost(url));

function safeHost(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

const BAD_HOSTS = /(^|\.)(google\.com|gstatic\.com|googleapis\.com|policies\.google\.com)$/i;

function isPublisherUrl(url: string | undefined | null): url is string {
  if (!url) return false;
  const host = safeHost(url);
  return !!host && !BAD_HOSTS.test(host);
}

/** Sebagian ID artikel lama menyimpan URL asli dalam base64. */
function fromBase64Id(articleId: string): string | null {
  try {
    const b64 = articleId.replace(/-/g, "+").replace(/_/g, "/");
    const raw = Buffer.from(b64, "base64").toString("latin1");
    const match = /https?:\/\/[^\s"'\\<>\u0000-\u001f]+/.exec(raw);
    if (match && isPublisherUrl(match[0])) return match[0].replace(/[^\w/?=&%.:#@~+-]+$/, "");
  } catch {
    /* ignore */
  }
  return null;
}

function articleIdFrom(url: string): string | null {
  const m = /\/(?:rss\/)?articles\/([^?/]+)/.exec(url);
  return m?.[1] ?? null;
}

const attr = (html: string, name: string) =>
  new RegExp(`${name}="([^"]+)"`).exec(html)?.[1] ?? null;

/** Endpoint internal Google News yang menukar id artikel dengan URL asli. */
async function fromBatchExecute(html: string, articleId: string): Promise<string | null> {
  const signature = attr(html, "data-n-a-sg");
  const timestamp = attr(html, "data-n-a-ts");
  if (!signature || !timestamp) return null;

  const inner = JSON.stringify([
    "garturlreq",
    [
      ["X", "X", ["X", "X"], null, null, 1, 1, "US:en", null, 1, null, null, null, null, null, 0, 1],
      "X",
      "X",
      1,
      [1, 1, 1],
      1,
      1,
      null,
      0,
      0,
      null,
      0,
    ],
    articleId,
    Number(timestamp),
    signature,
  ]);
  const body = new URLSearchParams({
    "f.req": JSON.stringify([[["Fbv4je", inner, null, "generic"]]]),
  });

  const res = await fetch(
    "https://news.google.com/_/DotsSplashUi/data/batchexecute?rpcids=Fbv4je",
    {
      method: "POST",
      headers: {
        "user-agent": UA,
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body,
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!res.ok) return null;
  const text = await res.text();
  const line = text.split("\n").find((l) => l.includes("garturlres"));
  if (!line) return null;
  try {
    const outer = JSON.parse(line) as unknown[][];
    for (const row of outer) {
      const payload = row?.[2];
      if (typeof payload !== "string" || !payload.includes("http")) continue;
      const parsed = JSON.parse(payload) as unknown[];
      const url = parsed?.[1];
      if (typeof url === "string" && isPublisherUrl(url)) return url;
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** Cari URL penerbit langsung di HTML halaman redirect. */
function fromHtml(html: string): string | null {
  const patterns = [
    /data-n-au="([^"]+)"/,
    /<meta[^>]+http-equiv="refresh"[^>]+url=([^"']+)["']/i,
    /<link[^>]+rel="canonical"[^>]+href="(https?:\/\/[^"]+)"/i,
    /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>/i,
  ];
  for (const re of patterns) {
    const value = re.exec(html)?.[1];
    if (isPublisherUrl(value)) return value!;
  }
  return null;
}

/** Kembalikan URL artikel penerbit; jika bukan link Google News, kembalikan apa adanya. */
export async function resolveGoogleNewsUrl(url: string): Promise<string> {
  if (!isGoogleNewsUrl(url)) return url;

  const articleId = articleIdFrom(url);
  if (articleId) {
    const decoded = fromBase64Id(articleId);
    if (decoded) return decoded;
  }

  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
    });
    if (isPublisherUrl(res.url)) return res.url;
    const html = await res.text();
    if (articleId) {
      const viaRpc = await fromBatchExecute(html, articleId);
      if (viaRpc) return viaRpc;
    }
    const viaHtml = fromHtml(html);
    if (viaHtml) return viaHtml;
  } catch {
    /* ignore */
  }

  return url;
}
