/**
 * Upload foto ke Google Drive.
 * - Foto besar diperkecil & dikompres jadi JPEG di browser (hemat kuota HP).
 * - Isi foto dikirim LANGSUNG dari browser ke Google Drive (resumable upload);
 *   server aplikasi hanya membuat sesi upload & mencatat hasilnya.
 * - Jika upload langsung gagal, foto kecil dikirim lewat server (base64)
 *   sebagai cadangan. Vercel menolak body > ±4,5 MB ("Request Entity Too Large").
 */
const SKIP_BELOW_BYTES = 1_200_000; // foto kecil dikirim apa adanya
const TARGET_BYTES = 1_500_000; // target ukuran setelah kompres

function readAsBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Gagal membaca file"));
    reader.readAsDataURL(blob);
  });
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Format foto tidak didukung browser"));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

export type PreparedImage = { blob: Blob; fileName: string; mimeType: string };

export async function prepareImage(file: File): Promise<PreparedImage> {
  const passthrough = async (): Promise<PreparedImage> => ({
    blob: file,
    fileName: file.name,
    mimeType: file.type || "image/jpeg",
  });
  if (file.size <= SKIP_BELOW_BYTES || file.type === "image/gif") return passthrough();

  let img: HTMLImageElement;
  try {
    img = await loadImage(file);
  } catch {
    return passthrough();
  }

  let best: Blob | null = null;
  for (const [maxSide, quality] of [
    [2048, 0.85],
    [1600, 0.8],
    [1280, 0.75],
    [1024, 0.7],
  ] as const) {
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) break;
    ctx.fillStyle = "#fff"; // latar putih untuk PNG transparan
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await canvasToBlob(canvas, quality);
    if (!blob) break;
    best = blob;
    if (blob.size <= TARGET_BYTES) break;
  }

  if (!best || best.size >= file.size) return passthrough();
  const base = file.name.replace(/\.[^.]+$/, "") || "foto";
  return { blob: best, fileName: `${base}.jpg`, mimeType: "image/jpeg" };
}

/** Kirim isi file langsung ke URL sesi resumable Drive; hasilnya ID file. */
async function putToDrive(uploadUrl: string, img: PreparedImage) {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": img.mimeType },
    body: img.blob,
  });
  if (!res.ok) throw new Error(`Upload ke Google Drive gagal [${res.status}]`);
  const json = (await res.json()) as { id?: string };
  if (!json.id) throw new Error("Google Drive tidak mengembalikan ID file");
  return json.id;
}

/** Batas aman jalur cadangan lewat server (base64 ±33% lebih besar). */
const FALLBACK_MAX_BYTES = 3_000_000;

/**
 * Upload satu foto: langsung ke Drive, atau cadangan lewat server.
 * `start` membuat sesi, `finish` mencatat file, `viaServer` jalur lama base64.
 */
export async function uploadImageToDrive<T>(
  file: File,
  api: {
    start: (meta: { fileName: string; mimeType: string; size: number }) => Promise<{
      uploadUrl: string;
    }>;
    finish: (meta: { fileId: string; fileName: string; mimeType: string }) => Promise<T>;
    viaServer: (meta: { fileName: string; mimeType: string; base64: string }) => Promise<T>;
  },
): Promise<T> {
  const img = await prepareImage(file);
  const meta = { fileName: img.fileName, mimeType: img.mimeType };
  let fileId: string;
  try {
    const { uploadUrl } = await api.start({ ...meta, size: img.blob.size });
    fileId = await putToDrive(uploadUrl, img);
  } catch (e) {
    if (img.blob.size > FALLBACK_MAX_BYTES) throw e;
    console.warn("Upload langsung ke Drive gagal, pakai jalur server:", e);
    return api.viaServer({ ...meta, base64: await readAsBase64(img.blob) });
  }
  return api.finish({ ...meta, fileId });
}

/** Pesan error yang lebih jelas untuk penolakan ukuran dari server. */
export function uploadErrorMessage(e: Error) {
  return /entity too large|413|payload too large/i.test(e.message)
    ? "Ukuran foto terlalu besar untuk diunggah. Coba foto lain atau perkecil resolusinya."
    : e.message;
}
