import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export const db = supabase as unknown as SupabaseClient;

/** Bucket Supabase Storage untuk foto master wajah pekerja. */
export const FACE_BUCKET = "worker-faces";

export type FaceStatus = "pending" | "indexed" | "failed";

export type WorkerFace = {
  id: string;
  worker_id: string | null;
  personal_number: string;
  reference_photo_url: string | null;
  status: FaceStatus;
  note: string | null;
  quality: number | null;
  updated_at: string | null;
};

/** Kolom aman (tanpa embedding) — embedding tidak pernah dibaca frontend. */
export const WORKER_FACE_COLUMNS =
  "id,worker_id,personal_number,reference_photo_url,status,note,quality,updated_at";

/** Persentase kualitas index wajah, mis. 90. */
export function facePercent(quality: number | null | undefined) {
  if (quality == null || Number.isNaN(quality)) return null;
  const v = quality > 1 ? quality : quality * 100;
  return Math.max(0, Math.min(100, Math.round(v)));
}

export const faceStatusLabel: Record<FaceStatus, string> = {
  pending: "Menunggu diproses",
  indexed: "Terindeks",
  failed: "Gagal — wajah tidak terdeteksi",
};

export const faceStatusVariant: Record<FaceStatus, "secondary" | "default" | "destructive"> = {
  pending: "secondary",
  indexed: "default",
  failed: "destructive",
};

export type EventPhoto = {
  id: string;
  event_id: string;
  drive_file_id: string;
  drive_view_link: string;
  file_name: string | null;
  matched_worker_ids: string[] | null;
  processed_at: string;
};

/** Thumbnail Drive (ringan) untuk grid galeri. */
export function driveThumb(fileId: string, size = 400) {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`;
}

/** Gambar resolusi besar, hanya dimuat saat foto dibuka. */
export function driveFull(fileId: string) {
  return driveThumb(fileId, 1600);
}
