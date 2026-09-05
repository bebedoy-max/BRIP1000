import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { AdminLayout, AccessDenied } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAccess } from "@/lib/access";

/** Aplikasi bawaan yang sudah dipaketkan bersama panel. */
const builtInApp = {
  name: "SuperIT Event Uploader",
  version: "1.2.14",
  description:
    "Aplikasi desktop pemroses foto event: sinkron wajah master, deteksi & pencocokan wajah, rename otomatis, upload ke Google Drive panel, lalu simpan hasilnya ke panel.",
  changelog:
    "- Perbaikan unggah foto event gagal 401 Unauthorized di tengah proses: token sesi admin kini diperbarui otomatis sebelum kedaluwarsa dan permintaan yang ditolak diulang dengan token baru\n- Perbaikan wheel InsightFace standalone: modul mask/mesh 3D opsional tidak lagi dimuat saat FaceAnalysis dijalankan, sehingga EXE tidak gagal karena mesh_core_cython\n- Instalasi Windows menyertakan wheel InsightFace siap pakai dan mengunci dependensi kompatibel; pip tidak mengompilasi stringzilla/InsightFace dan tidak memerlukan Visual Studio Build Tools\n- Build EXE otomatis memilih Python 3.11/3.12 64-bit dan berhenti dengan pesan BUILD GAGAL bila EXE belum terbentuk\n- Paket menyertakan Build-EXE-Windows.bat + SuperITEventUploader.spec: jalankan sekali di satu PC Windows untuk menghasilkan SuperITEventUploader.exe standalone yang tinggal dicopy ke PC lain tanpa perlu Python\n- Unggah foto event dikirim langsung ke Google Drive (resumable upload), sehingga foto besar dari HP tidak gagal dengan error 413 Request Entity Too Large\n- Deteksi wajah master lebih toleran untuk foto kecil/kompresi berat: EXIF rotation dibaca, kontras diperbaiki, threshold deteksi diturunkan, dicoba rotasi, upscale, dan crop scan untuk wajah yang jauh\n- Perbaikan akses event: role it_admin dapat membuat, mengubah, dan menghapus event sesuai policy RLS terbaru\n- Google Drive otomatis memakai akun Drive aktif di web app — client_secret.json tidak diperlukan",

  downloads: [
    {
      label: "Windows",
      url: "/api/public/companion/installer",
      hint: "Jalankan Install-Windows.bat, atau Build-EXE-Windows.bat untuk membuat .exe standalone",
    },
    {
      label: "macOS",
      url: "/downloads/SuperITEventUploader-1.2.14-macOS.zip",
      hint: "Jalankan Install-macOS.command",
    },
  ],
};


export const Route = createFileRoute("/_authenticated/admin/plugin")({
  head: () => ({
    meta: [
      { title: "Apps Ext — Panel BRI BO Pringsewu" },
      {
        name: "description",
        content: "Unduh aplikasi companion dan plugin pendukung panel SuperIT.",
      },
      { property: "og:title", content: "Apps Ext — Panel BRI BO Pringsewu" },
      {
        property: "og:description",
        content: "Daftar aplikasi companion dan plugin pendukung panel SuperIT.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const access = useAccess();


  return (
    <AdminLayout>
      {access.loading ? null : !access.isAdminLevel ? (
        <AccessDenied />
      ) : (
        <div className="space-y-5">
          <div>
            <h1 className="text-2xl font-bold">Apps Ext</h1>
            <p className="text-sm text-muted-foreground">
              Aplikasi tambahan pendukung panel: companion app pemroses foto event dan plugin
              lainnya.
            </p>
          </div>

          <article className="glass-card space-y-3 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{builtInApp.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{builtInApp.description}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge>Bawaan</Badge>
                <Badge variant="secondary">v{builtInApp.version}</Badge>
              </div>
            </div>
            <div className="rounded-xl border border-border/60 p-3 text-xs whitespace-pre-line text-muted-foreground">
              {builtInApp.changelog}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                Installer sekali klik — butuh Python 3.10–3.12 terpasang, sisanya otomatis.
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {builtInApp.downloads.map((d) => (
                  <Button
                    key={d.label}
                    asChild
                    size="sm"
                    variant={d.label === "Windows" ? "default" : "secondary"}
                  >
                    <a href={d.url} download title={d.hint}>
                      <Download className="size-4" /> Installer {d.label}
                    </a>
                  </Button>
                ))}
              </div>
            </div>
          </article>
        </div>
      )}
    </AdminLayout>
  );
}
