import { CalendarCheck, Gift, Sunrise, Trophy, Video, Vote, type LucideIcon } from "lucide-react";

/**
 * Registry tunggal untuk seluruh fitur di menu SuperIT Apps.
 * Dipakai oleh halaman /admin/tools dan otomatis menjadi topik panduan di menu
 * Tutorial, sehingga penambahan/pengurangan fitur cukup diubah di sini saja.
 */
export type SuperItApp = {
  key: string;
  to: string;
  label: string;
  /** Deskripsi singkat pada kartu aplikasi & konteks pembuatan panduan. */
  description: string;
  icon: LucideIcon;
  ready: boolean;
};

export const superItApps: SuperItApp[] = [
  {
    key: "absensi",
    to: "/admin/tools/absensi",
    label: "Absensi Event",
    description:
      "Buat absensi digital per event, atur field & tampilannya, bagikan linknya ke pekerja, lalu pantau datanya.",
    icon: CalendarCheck,
    ready: true,
  },
  {
    key: "doa-pagi",
    to: "/admin/tools/doa-pagi",
    label: "Absensi, Doa & Briefing Pagi",
    description:
      "Tampilan absensi doa & briefing pagi per bagian: pilih unit kerja, isi absen QRIS, dan pantau kehadiran hari kerja.",
    icon: Sunrise,
    ready: true,
  },
  {
    key: "vote",
    to: "/admin/tools/vote",
    label: "Vote",
    description:
      "Buat vote event, atur kategori & nominasi dari Data Pekerja, bagikan linknya, lalu pantau rekap suaranya.",
    icon: Vote,
    ready: true,
  },
  {
    key: "undian",
    to: "/admin/tools/undian",
    label: "Undian",
    description:
      "Undian doorprize acara: atur kategori, hadiah, dan peserta (bisa impor dari Data Pekerja), lalu kocok pemenangnya di panggung.",
    icon: Gift,
    ready: true,
  },
  {
    key: "nominasi",
    to: "/admin/tools/nominasi",
    label: "Nomination",
    description:
      "Papan apresiasi Best Performance: atur kategori & nominasi (bisa ambil dari Data Pekerja), lalu mainkan papan pengumumannya saat acara.",
    icon: Trophy,
    ready: true,
  },
  {
    key: "zoom",
    to: "/admin/tools/zoom",
    label: "Zoom Meeting",
    description:
      "Buat jadwal Zoom Meeting langsung dari panel: hubungkan akun Zoom, atur topik, agenda, waktu, durasi, lalu salin undangannya.",
    icon: Video,
    ready: true,
  },
];

/** Key topik panduan untuk sebuah sub-aplikasi SuperIT. */
export const superItTopicKey = (key: string) => `tools-${key}`;
