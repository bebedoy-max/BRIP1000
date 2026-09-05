/** Pengambilan suku bunga Deposito & Giro BRI dari situs resmi, dengan cache + fallback basi. */

export type DepositoRates = {
  lastUpdate: string | null;
  /** Bunga deposito rupiah per tenor (bulan). */
  rupiah: { tenor: string; rate: string }[];
  /** Bunga deposito valas per tenor. */
  valas: { tenor: string; rate: string }[];
};

export type GiroRates = {
  tiers: { label: string; rate: string }[];
};

export type BankRates = {
  deposito: DepositoRates | null;
  giro: GiroRates | null;
};

let cache: { at: number; data: BankRates } | null = null;
const CACHE_TTL = 6 * 60 * 60_000; // 6 jam

async function fetchText(url: string, timeoutMs = 15_000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Deposito: bri.co.id dilindungi anti-bot, jadi dibaca lewat Jina Reader (markdown). */
async function fetchDeposito(): Promise<DepositoRates | null> {
  const md = await fetchText("https://r.jina.ai/https://bri.co.id/web/guest/id/suku-bunga-bri", 30_000);
  if (!md || md.length < 500) return null;

  const lastUpdate = /_Last Update_\s*([^\n]+)/.exec(md)?.[1]?.trim() ?? null;

  // Ambil blok tabel "Deposito Rupiah" pertama: baris tenor tebal diikuti baris angka.
  const rupiahBlock = /\*\*Deposito Rupiah\*\*([\s\S]*?)(?:\*\*Deposito Valas\*\*|$)/.exec(md)?.[1] ?? "";
  const rupiahLines = rupiahBlock.split("\n").map((l) => l.trim());
  const rupiahRow = rupiahLines.find((l) => /^\|\s*[\d.,]+\s*%/.test(l));
  // Baris header tenor: "| **1** | **3** | **6** | ..."
  const tenorRow = rupiahLines.find((l) => /^\|\s*\*\*\d+\*\*\s*\|/.test(l));
  const rupiah: { tenor: string; rate: string }[] = [];
  if (rupiahRow) {
    const rates = rupiahRow.split("|").map((s) => s.trim()).filter(Boolean);
    const parsedTenors = (tenorRow ?? "")
      .split("|")
      .map((s) => s.replace(/\*/g, "").trim())
      .filter((s) => /^\d+$/.test(s))
      .map((n) => `${n} bln`);
    const tenors = parsedTenors.length === rates.length
      ? parsedTenors
      : ["1 bln", "3 bln", "6 bln", "12 bln", "24 bln", "36 bln"];
    rates.forEach((r, i) => rupiah.push({ tenor: tenors[i] ?? `Tenor ${i + 1}`, rate: r }));
  }


  const valasBlock = /\*\*Deposito Valas\*\*([\s\S]*?)(?:!\[|_Last Update_|$)/.exec(md)?.[1] ?? "";
  const valasRowLine = valasBlock
    .split("\n")
    .find((l) => /Seluruh Tiering Saldo/.test(l));
  const valas: { tenor: string; rate: string }[] = [];
  if (valasRowLine) {
    const rates = valasRowLine.split("|").map((s) => s.trim()).filter((s) => /%$/.test(s));
    const tenors = ["1 bln", "3 bln", "6 bln", "12 bln"];
    rates.forEach((r, i) => valas.push({ tenor: tenors[i] ?? `Tenor ${i + 1}`, rate: r }));
  }

  if (!rupiah.length && !valas.length) return null;
  return { lastUpdate, rupiah, valas };
}

/** Giro: halaman eform BRI, tiering jasa giro dalam teks HTML. */
async function fetchGiro(): Promise<GiroRates | null> {
  const html = await fetchText("https://eform.bri.co.id/home/detail/giro");
  if (!html) return null;
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");

  const tiers: { label: string; rate: string }[] = [];
  const re = /((?:[<>]\s*)?\d[\d.,]*\s*(?:juta|M)(?:\s*s\/d\s*\d[\d.,]*\s*(?:juta|M))?|>\s*\d[\d.,]*\s*(?:juta|M))\s*:\s*([\d.,]+)\s*%/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    tiers.push({ label: m[1]!.trim(), rate: `${m[2]}%` });
    if (tiers.length >= 8) break;
  }
  if (!tiers.length) return null;
  return { tiers };
}

export async function getBankRates(): Promise<BankRates> {
  if (cache && Date.now() - cache.at < CACHE_TTL) return cache.data;
  const [deposito, giro] = await Promise.all([fetchDeposito(), fetchGiro()]);
  const data: BankRates = {
    deposito: deposito ?? cache?.data.deposito ?? null,
    giro: giro ?? cache?.data.giro ?? null,
  };
  if (data.deposito || data.giro) cache = { at: Date.now(), data };
  return data;
}
