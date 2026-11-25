/**
 * Siapkan foto untuk diunggah lewat server function (base64 dalam JSON).
 * Foto kamera HP bisa 3–10 MB; setelah base64 permintaannya ditolak server
 * hosting ("Request Entity Too Large"). Foto besar diperkecil & dikompres
 * jadi JPEG di browser sebelum dikirim.
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

export async function prepareImageUpload(
  file: File,
): Promise<{ fileName: string; mimeType: string; base64: string }> {
  const passthrough = async () => ({
    fileName: file.name,
    mimeType: file.type || "image/jpeg",
    base64: await readAsBase64(file),
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
  return { fileName: `${base}.jpg`, mimeType: "image/jpeg", base64: await readAsBase64(best) };
}

/** Pesan error yang lebih jelas untuk penolakan ukuran dari server. */
export function uploadErrorMessage(e: Error) {
  return /entity too large|413|payload too large/i.test(e.message)
    ? "Ukuran foto terlalu besar untuk diunggah. Coba foto lain atau perkecil resolusinya."
    : e.message;
}
