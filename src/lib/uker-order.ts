/**
 * Urutan baku unit kerja di seluruh aplikasi:
 * Kantor Cabang → KCP → BRI Unit → Teras BRI → lainnya.
 */

/** Peringkat urutan berdasarkan nama uker (dan tipe kantor bila tersedia). */
export function ukerRank(nama?: string | null, tipe?: string | null): number {
  const t = String(tipe ?? "").toLowerCase();
  if (t) {
    if (t.includes("cabang") && !t.includes("pembantu") && !t.startsWith("kcp")) return 0;
    if (t.includes("kcp") || t.includes("pembantu")) return 1;
    if (t.includes("unit")) return 2;
    if (t.includes("teras")) return 3;
  }
  const n = String(nama ?? "").trim().toLowerCase();
  if (/^(kcp|kantor cabang pembantu)\b/.test(n)) return 1;
  if (/^(kc|kanca|kantor cabang|bo|branch office)\b/.test(n)) return 0;
  if (/\bunit\b/.test(n)) return 2;
  if (/\bteras\b/.test(n)) return 3;
  return 4;
}

/** Pembanding untuk Array.prototype.sort pada nama uker. */
export function compareUkerName(a?: string | null, b?: string | null): number {
  const ra = ukerRank(a);
  const rb = ukerRank(b);
  if (ra !== rb) return ra - rb;
  return String(a ?? "").localeCompare(String(b ?? ""), "id");
}

/** Urutkan daftar nama uker. */
export function sortUkerNames(list: (string | null | undefined)[]): string[] {
  return [...list].filter((x): x is string => !!x).sort(compareUkerName);
}

/** Urutkan daftar objek uker memakai pengambil nama (dan tipe opsional). */
export function sortByUker<T>(
  list: T[],
  nameOf: (item: T) => string | null | undefined,
  typeOf?: (item: T) => string | null | undefined,
): T[] {
  return [...list].sort((a, b) => {
    const ra = ukerRank(nameOf(a), typeOf?.(a));
    const rb = ukerRank(nameOf(b), typeOf?.(b));
    if (ra !== rb) return ra - rb;
    return String(nameOf(a) ?? "").localeCompare(String(nameOf(b) ?? ""), "id");
  });
}
