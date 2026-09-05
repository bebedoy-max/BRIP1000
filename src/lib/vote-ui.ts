/** Helper klien untuk SuperIT Apps — Vote. */

export type VoteCategory = { name: string; icon: string; color: string };

export type VoteNominee = {
  id: string;
  category: string;
  nama: string;
  jabatan: string | null;
  uker: string | null;
  personalNumber: string | null;
  foto: string | null;
  sortOrder: number;
};

export type VoteSettings = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  eyebrow: string;
  showcaseNote: string;
  location: string;
  eventDate: string;
  accent: string;
  logo: string | null;
  categories: VoteCategory[];
  isHold: boolean;
  isClosed: boolean;
};

export type VoteResultRow = { category: string; nominee: string; total: number };

export type VoteVoterStats = {
  totalVoters: number;
  votedCount: number;
  notVotedCount: number;
};

export const votePalette = [
  "#a855f7",
  "#22d3ee",
  "#f472b6",
  "#34d399",
  "#fbbf24",
  "#f87171",
  "#60a5fa",
  "#fb923c",
];

export const voteIcons = ["🛡️", "🤝", "✅", "🌱", "💛", "🏆", "⭐", "🎯", "💎", "🔥", "🚀", "👑"];

export const defaultVoteCategories: VoteCategory[] = [
  { name: "Integrity", icon: "🛡️", color: "#a855f7" },
  { name: "Collaborative", icon: "🤝", color: "#22d3ee" },
  { name: "Accountability", icon: "✅", color: "#f472b6" },
  { name: "Growth Mindset", icon: "🌱", color: "#34d399" },
  { name: "Customer Focus", icon: "💛", color: "#fbbf24" },
];

export function voteInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/** Rekap suara per kategori, terurut dari perolehan terbanyak. */
export function rankNominees(
  nominees: VoteNominee[],
  results: VoteResultRow[],
  category: string,
) {
  const counts: Record<string, number> = {};
  results
    .filter((r) => r.category === category)
    .forEach((r) => (counts[r.nominee] = Number(r.total) || 0));
  return nominees
    .filter((n) => n.category === category)
    .map((n) => ({ ...n, total: counts[n.nama] ?? 0 }))
    .sort((a, b) => b.total - a.total);
}

function esc(v: string) {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Cetak / simpan PDF rekap suara lewat jendela print browser. */
export function printVoteReport(
  settings: VoteSettings,
  nominees: VoteNominee[],
  results: VoteResultRow[],
  stats: VoteVoterStats,
) {
  const blocks = settings.categories
    .map((cat) => {
      const list = rankNominees(nominees, results, cat.name);
      const rows =
        list
          .map(
            (x, i) =>
              `<tr><td>${i === 0 && x.total > 0 ? "🏆" : i + 1}</td><td>${esc(x.nama)}</td><td>${esc(
                x.jabatan || "-",
              )}</td><td>${esc(x.uker || "-")}</td><td><b>${x.total}</b></td></tr>`,
          )
          .join("") || `<tr><td colspan="5">Belum ada nominasi.</td></tr>`;
      return `<h2>${esc(cat.icon)} ${esc(cat.name)}</h2>
      <table><thead><tr><th>#</th><th>Nama</th><th>Jabatan</th><th>Unit Kerja</th><th>Suara</th></tr></thead>
      <tbody>${rows}</tbody></table>`;
    })
    .join("");

  const html = `<html><head><meta charset="utf-8" /><title>Rekap Vote — ${esc(settings.title)}</title>
  <style>body{font-family:Arial,Helvetica,sans-serif;padding:24px;color:#111}
  h1{font-size:18px;margin:0 0 4px}h2{font-size:14px;margin:18px 0 6px}
  p{margin:0 0 4px;font-size:12px;color:#555}
  table{border-collapse:collapse;width:100%;font-size:11px}
  th,td{border:1px solid #bbb;padding:6px 8px;text-align:left}th{background:#f0f0f0}</style></head><body>
  <h1>${esc(settings.title)} ${esc(settings.subtitle)} — Rekap Vote</h1>
  <p>Dicetak: ${new Date().toLocaleString("id-ID")}</p>
  <p>Total pemilih terdaftar: ${stats.totalVoters}</p>
  <p>Sudah memilih: ${stats.votedCount} · Belum memilih: ${stats.notVotedCount}</p>
  ${blocks}
  <script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script>
  </body></html>`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
