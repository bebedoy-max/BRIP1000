/** Tipe & helper klien untuk SuperIT Apps — Nomination. */

export type NominasiNominee = {
  id: string;
  name: string;
  position: string;
  photo: string | null;
};

export type NominasiCategory = {
  id: string;
  name: string;
  nominees: NominasiNominee[];
};

export type NominasiBoard = {
  heading: string;
  period: string;
  unit: string;
  logo: string | null;
  logoHeight: number;
  logo2: string | null;
  logo2Height: number;
  categories: NominasiCategory[];
};

export type NominasiEvent = {
  id: string;
  namaAcara: string;
  tanggal: string;
  data: NominasiBoard;
};

export const uid = () => Math.random().toString(36).slice(2, 10);

export const emptyNominee = (
  name = "Nama Insan BRILiaN",
  position = "Jabatan",
): NominasiNominee => ({ id: uid(), name, position, photo: null });

export function defaultBoard(): NominasiBoard {
  return {
    heading: "BEST PERFORMANCE",
    period: "Semester I",
    unit: "BO PRINGSEWU",
    logo: null,
    logoHeight: 48,
    logo2: null,
    logo2Height: 40,
    categories: [
      { id: uid(), name: "BEST RM", nominees: [emptyNominee(), emptyNominee(), emptyNominee()] },
      { id: uid(), name: "BEST SOL", nominees: [emptyNominee(), emptyNominee()] },
      { id: uid(), name: "BEST MANTRI", nominees: [emptyNominee(), emptyNominee(), emptyNominee()] },
    ],
  };
}

export function normalizeBoard(raw: unknown): NominasiBoard {
  const base = defaultBoard();
  const b = (raw ?? {}) as Partial<NominasiBoard>;
  return {
    ...base,
    ...b,
    categories: Array.isArray(b.categories) && b.categories.length ? b.categories : base.categories,
  };
}

const BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export function formatTanggalIndo(dateStr?: string | null) {
  if (!dateStr) return "-";
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return dateStr;
  return `${parseInt(d, 10)} ${BULAN[parseInt(m, 10) - 1] ?? m} ${y}`;
}

/** Resize + compress foto nominasi. */
export function fileToCompressedDataUrl(file: File, max = 640): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca berkas"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Berkas bukan gambar yang valid"));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas tidak tersedia"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/** Resize logo tapi pertahankan transparansi PNG. */
export function fileToTransparentDataUrl(file: File, max = 512): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca berkas"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Berkas bukan gambar yang valid"));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas tidak tersedia"));
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
