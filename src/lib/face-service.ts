import { db } from "@/lib/face";

/** URL mesin wajah di VPS (face-service/). Kosong = belum dihubungkan. */
export const FACE_SERVICE_URL = (
  (import.meta.env["VITE_FACE_SERVICE_URL"] as string | undefined) ?? ""
).replace(/\/+$/, "");

export const IMAGE_EXT = /\.(jpe?g|png|webp|bmp)$/i;
export const MATCH_THRESHOLD = 0.6;
export const MATCH_COUNT = 5;

export async function accessToken(): Promise<string> {
  const { data } = await db.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sesi login berakhir. Silakan login ulang.");
  return token;
}

export async function currentUserId(): Promise<string | null> {
  const { data } = await db.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function faceServiceOnline(): Promise<boolean> {
  if (!FACE_SERVICE_URL) return false;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 6000);
    const res = await fetch(`${FACE_SERVICE_URL}/health`, { signal: ctl.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

async function postFile<T>(path: string, file: Blob, name: string): Promise<T> {
  const fd = new FormData();
  fd.append("file", file, name);
  const res = await fetch(`${FACE_SERVICE_URL}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${await accessToken()}` },
    body: fd,
  });
  if (!res.ok) {
    let msg = `Mesin wajah error [${res.status}]`;
    try {
      const j = (await res.json()) as { detail?: string };
      if (j.detail) msg = j.detail;
    } catch {
      /* abaikan */
    }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

export const embedEventPhoto = (file: Blob, name: string) =>
  postFile<{ faces: number; embeddings: number[][] }>("/embed", file, name);

export const embedMasterPhoto = (file: Blob, name: string) =>
  postFile<{ found: boolean; embedding?: number[]; quality?: number }>("/master", file, name);

export type Match = {
  worker_id: string | null;
  personal_number: string | null;
  similarity: number;
};

export async function matchFace(embedding: number[]): Promise<Match[]> {
  const { data, error } = await db.rpc("match_worker_faces", {
    query_embedding: embedding as unknown as string,
    match_threshold: MATCH_THRESHOLD,
    match_count: MATCH_COUNT,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as Match[];
}

async function companionPost<T>(path: string, body: unknown): Promise<T> {
  let last = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`/api/public/companion/${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${await accessToken()}`,
      },
      body: JSON.stringify(body),
    });
    if (res.ok) return (await res.json()) as T;
    last = `[${res.status}] ${(await res.text()).slice(0, 200)}`;
    if ([401, 429, 500, 502, 503].includes(res.status) && attempt < 3) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    break;
  }
  throw new Error(last);
}

/** Unggah langsung ke Google Drive (resumable); folder event dibuat otomatis oleh server. */
export async function uploadToDrive(
  eventName: string,
  file: File,
  fileName: string,
): Promise<{ id: string; link: string; folderId: string }> {
  const mime = file.type || "image/jpeg";
  const init = await companionPost<{ uploadUrl: string; folderId: string }>("upload-url", {
    subfolder: eventName,
    fileName,
    mimeType: mime,
  });
  let last = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const put = await fetch(init.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": mime },
      body: file,
    });
    if (put.ok) {
      const j = (await put.json()) as { id: string; webViewLink?: string };
      await companionPost("finalize", { fileId: j.id }).catch(() => null);
      return {
        id: j.id,
        link: j.webViewLink ?? `https://drive.google.com/file/d/${j.id}/view`,
        folderId: init.folderId,
      };
    }
    last = `[${put.status}] ${(await put.text()).slice(0, 200)}`;
    if (![429, 500, 502, 503].includes(put.status)) break;
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }
  throw new Error(`Gagal unggah ke Drive: ${last}`);
}
