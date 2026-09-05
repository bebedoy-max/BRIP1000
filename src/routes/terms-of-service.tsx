import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle, Gavel, UserCheck, Lock, AlertTriangle } from "lucide-react";
import { PublicLayout } from "@/components/PublicLayout";

export const Route = createFileRoute("/terms-of-service")({
  head: () => ({
    meta: [
      { title: "Ketentuan Layanan — BRI BO Pringsewu" },
      {
        name: "description",
        content:
          "Ketentuan layanan aplikasi internal BRI Branch Office Pringsewu: hak, kewajiban, dan aturan penggunaan sistem.",
      },
      { property: "og:title", content: "Ketentuan Layanan — BRI BO Pringsewu" },
      {
        property: "og:description",
        content: "Ketentuan layanan aplikasi internal BRI Branch Office Pringsewu.",
      },
    ],
  }),
  component: TermsOfService,
});

const sections = [
  {
    icon: UserCheck,
    title: "1. Penerimaan Ketentuan",
    body: "Dengan mengakses dan menggunakan aplikasi ini, pengguna menyetujui seluruh ketentuan layanan yang berlaku. Aplikasi ini ditujukan khusus untuk pegawai dan petugas yang berwenang di lingkungan BRI Branch Office Pringsewu.",
  },
  {
    icon: Lock,
    title: "2. Akun dan Akses",
    body: "Pengguna wajib menjaga kerahasiaan kredensial akun. Setiap aktivitas yang terjadi dalam akun pengguna menjadi tanggung jawab pemilik akun. Akses ke menu tertentu ditentukan oleh peran dan izin yang diberikan admin.",
  },
  {
    icon: Gavel,
    title: "3. Penggunaan yang Dilarang",
    body: "Dilarang menyalahgunakan aplikasi untuk mengakses data tanpa izin, memanipulasi informasi, mengunggah konten tidak relevan, atau melakukan tindakan yang dapat merusak sistem dan reputasi institusi.",
  },
  {
    icon: AlertTriangle,
    title: "4. Pembatasan Tanggung Jawab",
    body: "Aplikasi ini disediakan sebagaimana adanya untuk mendukung operasional internal. Kami berupaya menjaga ketersediaan dan keakuratan data, namun tidak bertanggung jawab atas kerugian akibat penggunaan di luar ketentuan.",
  },
  {
    icon: CheckCircle,
    title: "5. Perubahan Ketentuan",
    body: "Ketentuan layanan dapat diperbarui sewaktu-waktu sesuai kebutuhan operasional dan kebijakan internal. Pengguna diharapkan meninjau halaman ini secara berkala.",
  },
];

function TermsOfService() {
  return (
    <PublicLayout>
      <h1 className="text-3xl font-bold">
        Ketentuan <span className="gradient-text">Layanan</span>
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Ketentuan ini mengatur penggunaan aplikasi internal BRI Branch Office Pringsewu oleh
        pegawai dan petugas yang berwenang.
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
