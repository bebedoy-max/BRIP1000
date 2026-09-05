/** Jenis data yang punya galeri foto di Google Drive. */
export type PhotoEntity =
  | "uker"
  | "atm"
  | "crm"
  | "edc"
  | "pegawai"
  | "perangkat"
  | "event"
  | "absensi"
  | "project"
  | "buku-harian";

export const photoEntities: Record<PhotoEntity, { label: string; folder: string }> = {
  uker: { label: "Unit Kerja", folder: "Foto Unit Kerja" },
  atm: { label: "Mesin ATM", folder: "Foto Mesin ATM" },
  crm: { label: "Mesin CRM", folder: "Foto Mesin CRM" },
  edc: { label: "Mesin EDC", folder: "Foto Mesin EDC" },
  pegawai: { label: "Data Pekerja", folder: "Foto Data Pekerja" },
  perangkat: { label: "Data Perangkat IT", folder: "Foto Data Perangkat IT" },
  event: { label: "Event", folder: "Foto Event" },
  absensi: { label: "Absensi Event", folder: "Foto Absensi" },
  project: { label: "Project IT", folder: "Foto Project IT" },
  "buku-harian": { label: "Buku Harian IT", folder: "Foto Buku Harian IT" },
};


export const photoEntityKeys = Object.keys(photoEntities) as PhotoEntity[];

export function isPhotoEntity(v: string): v is PhotoEntity {
  return (photoEntityKeys as string[]).includes(v);
}

/** URL gambar Drive yang bisa dipakai di tag <img>. */
export function driveImageUrl(fileId: string, width = 1000) {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${width}`;
}

export const DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");
