import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck, BookOpen, LifeBuoy, ShieldAlert } from "lucide-react";
import { PublicLayout } from "@/components/PublicLayout";

export const Route = createFileRoute("/informasi")({
  head: () => ({
    meta: [
      { title: "Informasi Umum — BRI BO Pringsewu" },
      {
        name: "description",
        content:
          "Informasi umum layanan, prosedur absensi kegiatan, dan panduan bantuan IT untuk pegawai BRI BO Pringsewu.",
      },
      { property: "og:title", content: "Informasi Umum — BRI BO Pringsewu" },
      {
        property: "og:description",
        content: "Layanan, prosedur absensi kegiatan, dan bantuan IT BRI BO Pringsewu.",
      },
    ],
  }),
  component: Informasi,
});

const items = [
  {
    icon: BadgeCheck,
    title: "Layanan Unit Kerja",
    body: "Seluruh unit kerja melayani transaksi perbankan pada hari kerja pukul 08.00–15.00 WIB. Layanan e-channel (ATM/EDC) beroperasi 24 jam.",
  },
  {
    icon: BookOpen,
    title: "Absensi Kegiatan",
    body: "Peserta kegiatan mengisi absensi melalui tautan atau QR code yang dibagikan panitia. Tidak perlu akun—cukup isi nama dan unit kerja.",
  },
  {
    icon: LifeBuoy,
    title: "Bantuan IT",
    body: "Kendala perangkat, jaringan, atau aplikasi dilaporkan melalui modul Tiket IT oleh pegawai yang telah memiliki akun internal.",
  },
  {
    icon: ShieldAlert,
    title: "Keamanan Informasi",
    body: "Data alamat IP dan seluruh konten area IT bersifat rahasia dan hanya dapat diakses oleh petugas IT yang berwenang.",
  },
];

function Informasi() {
  return (
    <PublicLayout>
      <h1 className="text-3xl font-bold">
        Informasi <span className="gradient-text">Umum</span>
      </h1>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {items.map((i) => (
          <article key={i.title} className="glass-card p-6">
            <span
              className="grid size-10 place-items-center rounded-xl"
              style={{ backgroundImage: "var(--gradient-stat)" }}
            >
              <i.icon className="size-4 text-primary-foreground" />
            </span>
            <h2 className="mt-4 font-semibold">{i.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{i.body}</p>
          </article>
        ))}
      </div>
    </PublicLayout>
  );
}