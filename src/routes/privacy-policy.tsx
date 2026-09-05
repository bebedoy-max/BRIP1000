import { createFileRoute } from "@tanstack/react-router";
import { FileLock, Shield, Eye, Server, Mail } from "lucide-react";
import { PublicLayout } from "@/components/PublicLayout";

export const Route = createFileRoute("/privacy-policy")({
  head: () => ({
    meta: [
      { title: "Kebijakan Privasi — BRI BO Pringsewu" },
      {
        name: "description",
        content:
          "Kebijakan privasi aplikasi internal BRI Branch Office Pringsewu: pengumpulan, penggunaan, dan perlindungan data pengguna.",
      },
      { property: "og:title", content: "Kebijakan Privasi — BRI BO Pringsewu" },
      {
        property: "og:description",
        content: "Kebijakan privasi aplikasi internal BRI Branch Office Pringsewu.",
      },
    ],
  }),
  component: PrivacyPolicy,
});

const sections = [
  {
    icon: Eye,
    title: "1. Informasi yang Kami Kumpulkan",
    body: "Aplikasi ini mengumpulkan informasi identitas pegawai seperti nama, alamat email, unit kerja, dan jabatan saat proses registrasi atau login. Kami juga mencatat log aktivitas untuk keperluan audit dan keamanan sistem.",
  },
  {
    icon: Shield,
    title: "2. Penggunaan Informasi",
    body: "Data yang dikumpulkan digunakan untuk mengelola akses menu, merekam audit log, mendukung operasional IT, serta menampilkan dashboard internal sesuai hak akses masing-masing pengguna.",
  },
  {
    icon: FileLock,
    title: "3. Penyimpanan dan Keamanan Data",
    body: "Data disimpan di backend yang dilindungi dengan autentikasi dan kontrol akses berbasis peran. Kami tidak membagikan data pegawai kepada pihak ketiga di luar lingkup operasional kantor.",
  },
  {
    icon: Server,
    title: "4. Integrasi Pihak Ketiga",
    body: "Aplikasi dapat terhubung ke layanan Google Drive untuk keperluan penyimpanan file internal. Akses tersebut hanya diaktifkan atas persetujuan admin dan terbatas pada akun organisasi yang relevan.",
  },
  {
    icon: Mail,
    title: "5. Hubungi Kami",
    body: "Jika ada pertanyaan terkait kebijakan privasi ini, silakan hubungi tim IT BRI Branch Office Pringsewu melalui kanal internal yang tersedia.",
  },
];

function PrivacyPolicy() {
  return (
    <PublicLayout>
      <h1 className="text-3xl font-bold">
        Kebijakan <span className="gradient-text">Privasi</span>
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Kebijakan privasi ini menjelaskan bagaimana aplikasi internal BRI Branch Office Pringsewu
        mengumpulkan, menggunakan, dan melindungi informasi penggunanya.
      </p>

      <div className="mt-6 grid gap-4">
        {sections.map((s) => (
          <article key={s.title} className="glass-card p-6">
            <span
              className="grid size-10 place-items-center rounded-xl"
              style={{ backgroundImage: "var(--gradient-stat)" }}
            >
              <s.icon className="size-4 text-primary-foreground" />
            </span>
            <h2 className="mt-4 font-semibold">{s.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
          </article>
        ))}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Terakhir diperbarui: {new Date().getFullYear()}.
      </p>
    </PublicLayout>
  );
}
