/** Helper klien untuk SuperIT Apps — Absensi Event. */

export type AbsensiFields = {
  nama: boolean;
  personalNumber: boolean;
  unitKerja: boolean;
  noTelp: boolean;
  fotoSelfie: boolean;
};

export type AbsensiSettings = {
  id: string;
  slug: string;
  eventName: string;
  officeName: string;
  eventDate: string;
  logo: string | null;
  logoLeft: string | null;
  logoRight: string | null;
  logoLeftSize: number;
  logoRightSize: number;
  logoLeftTop: number;
  logoRightTop: number;
  background: string | null;
  cardBackground: string | null;
  themeColor: string;
  fields: AbsensiFields;
  unitKerjaList: string[];
  isOpen: boolean;
};

export type AbsensiEntry = {
  id: string;
  submittedAt: string;
  nama: string | null;
  personalNumber: string | null;
  unitKerja: string | null;
  noTelp: string | null;
  photoUrl: string | null;
  photoThumbnailUrl: string | null;
};

export const absensiFieldLabels: Record<keyof AbsensiFields, string> = {
  nama: "Nama",
  personalNumber: "Personal Number",
  unitKerja: "Unit Kerja",
  noTelp: "Nomor Telp.",
  fotoSelfie: "Foto Selfie di Lokasi",
};

export type ThemePreset = {
  key: string;
  label: string;
  accent: string;
  accentDark: string;
  navy: string;
  card: string;
  field: string;
  border: string;
};

export const themePresets: ThemePreset[] = [
  { key: "gold", label: "Emas (default)", accent: "#EF9F27", accentDark: "#BA7517", navy: "#0b1220", card: "#151d30", field: "#1c2540", border: "#2c3550" },
  { key: "biru", label: "Biru BRI", accent: "#3B9BE8", accentDark: "#1B6FB5", navy: "#071426", card: "#0f2035", field: "#152a45", border: "#22395a" },
  { key: "hijau", label: "Hijau Zamrud", accent: "#37C98B", accentDark: "#1F9463", navy: "#07170f", card: "#0e2419", field: "#132f21", border: "#1e4534" },
  { key: "merah", label: "Merah Marun", accent: "#F0654F", accentDark: "#B03B29", navy: "#180b0b", card: "#241213", field: "#2f1719", border: "#472326" },
  { key: "ungu", label: "Ungu Senja", accent: "#A98BF5", accentDark: "#7454C6", navy: "#0f0b1e", card: "#1a1430", field: "#221a3d", border: "#342a58" },
  { key: "terang", label: "Terang", accent: "#D98410", accentDark: "#A5620A", navy: "#f2f4f8", card: "#ffffff", field: "#eef1f6", border: "#d6dbe6" },
];

export function themeVars(key: string): Record<string, string> {
  const t = themePresets.find((p) => p.key === key) ?? themePresets[0]!;
  const light = t.key === "terang";
  return {
    "--gold": t.accent,
    "--gold-dark": t.accentDark,
    "--navy": t.navy,
    "--navy-card": t.card,
    "--navy-field": t.field,
    "--navy-border": t.border,
    "--text-dim": light ? "#5d6577" : "#9aa3b8",
    "--app-text": light ? "#131826" : "#f2f3f7",
    "--overlay-1": light ? "rgba(242,244,248,0.82)" : "rgba(11,18,32,0.88)",
    "--overlay-2": light ? "rgba(242,244,248,0.94)" : "rgba(11,18,32,0.96)",
  };
}

export const defaultUnitKerjaList = [
  "KC Pringsewu", "KCP Kota Agung", "KCP Gedong Tataan", "Unit Sukaraja", "Unit Wonosobo",
  "Unit Kotaagung", "Unit Gisting", "Unit Talang Padang", "Unit Sumberejo", "Unit Ulubelu",
  "Unit Pulau Panggung", "Unit Pagelaran", "Unit Sumber Agung", "Unit Pardasuka", "Unit Kedondong",
  "Unit Adiluwih", "Unit Roworejo", "Unit Banyumas", "Unit Sukoharjo", "Unit Pringsewu 2",
  "Unit Pringsewu 1", "Unit Bulukarto", "Unit Gading Rejo", "Unit Gedong Tataan",
];

export function formatDateID(dateStr?: string) {
  if (!dateStr) return "";
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/** Kecilkan ukuran gambar data-url agar hemat penyimpanan. */
export function compressImage(dataUrl: string, maxSize = 900, quality = 0.82) {
  const keepAlpha = /^data:image\/(png|webp|gif|svg\+xml)/i.test(dataUrl);
  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(keepAlpha ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function pickImage(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    };
    input.click();
  });
}

const HEADERS = ["Waktu", "Nama", "Personal Number", "Unit Kerja", "No. Telp"];

function esc(v: string) {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function rowsOf(list: AbsensiEntry[]) {
  return list.map((r) => [
    new Date(r.submittedAt).toLocaleString("id-ID"),
    r.nama || "-",
    r.personalNumber || "-",
    r.unitKerja || "-",
    r.noTelp || "-",
  ]);
}

function download(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportAbsensiJSON(list: AbsensiEntry[]) {
  download(JSON.stringify(list, null, 2), "absensi-export.json", "application/json");
}

export function exportAbsensiExcel(list: AbsensiEntry[]) {
  const body = rowsOf(list)
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
    .join("");
  const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8" /></head><body><table border="1"><thead><tr>${HEADERS.map(
    (h) => `<th>${h}</th>`,
  ).join("")}</tr></thead><tbody>${body}</tbody></table></body></html>`;
  download("\ufeff" + html, "data-absensi.xls", "application/vnd.ms-excel");
}

export function exportAbsensiPDF(list: AbsensiEntry[], title = "Data Absensi") {
  const body = list
    .map((r) => {
      const cells = [
        new Date(r.submittedAt).toLocaleString("id-ID"),
        r.nama || "-",
        r.personalNumber || "-",
        r.unitKerja || "-",
        r.noTelp || "-",
      ]
        .map((c) => `<td>${esc(c)}</td>`)
        .join("");
      const photo = r.photoThumbnailUrl
        ? `<td><img src="${r.photoThumbnailUrl}" style="width:56px;height:56px;object-fit:cover;border-radius:6px" /></td>`
        : "<td>-</td>";
      return `<tr>${cells}${photo}</tr>`;
    })
    .join("");
  const html = `<html><head><meta charset="utf-8" /><title>${esc(title)}</title>
  <style>body{font-family:Arial,Helvetica,sans-serif;padding:24px;color:#111}
  h1{font-size:18px;margin:0 0 4px}p{margin:0 0 16px;font-size:12px;color:#555}
  table{border-collapse:collapse;width:100%;font-size:11px}
  th,td{border:1px solid #bbb;padding:6px 8px;text-align:left}
  th{background:#f0f0f0}</style></head><body>
  <h1>${esc(title)}</h1><p>Total peserta: ${list.length}</p>
  <table><thead><tr>${[...HEADERS, "Foto"].map((h) => `<th>${h}</th>`).join("")}</tr></thead>
  <tbody>${body || `<tr><td colspan="6">Belum ada data.</td></tr>`}</tbody></table>
  <script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script>
  </body></html>`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Bagian pengaturan tampilan yang bisa dipakai sebagai default absensi event baru. */
export type AbsensiDisplay = Pick<
  AbsensiSettings,
  | "logo"
  | "logoLeft"
  | "logoRight"
  | "logoLeftSize"
  | "logoRightSize"
  | "logoLeftTop"
  | "logoRightTop"
  | "background"
  | "cardBackground"
  | "themeColor"
>;

export const defaultAbsensiDisplay: AbsensiDisplay = {
  logo: null,
  logoLeft: null,
  logoRight: null,
  logoLeftSize: 136,
  logoRightSize: 136,
  logoLeftTop: 14,
  logoRightTop: 14,
  background: null,
  cardBackground: null,
  themeColor: "gold",
};
