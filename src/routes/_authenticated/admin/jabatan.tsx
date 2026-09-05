import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout, AccessDenied } from "@/components/AdminLayout";
import { ResourceManager } from "@/components/ResourceManager";
import { useRoles } from "@/lib/roles";
import { jobAccessLevelLabels } from "@/lib/access";


export const Route = createFileRoute("/_authenticated/admin/jabatan")({
  head: () => ({
    meta: [
      { title: "Kategori Jabatan — Panel BRI BO Pringsewu" },
      { name: "description", content: "Master data kategori jabatan pekerja." },
      { property: "og:title", content: "Kategori Jabatan — Panel BRI BO Pringsewu" },
      { property: "og:description", content: "Master data kategori jabatan pekerja." },
    ],
  }),
  component: Page,
});

function Page() {
  const r = useRoles();
  return (
    <AdminLayout>
      {r.loading ? null : r.isItAdmin ? (
        <ResourceManager
          table="job_titles"
          title="Kategori Jabatan"
          description="Master data jabatan yang dipakai pada menu Data Pekerja."
          canWrite={r.isItAdmin}
          fields={[
            { key: "nama_jabatan", label: "Nama Jabatan", required: true },
            {
              key: "tipe_unit_kerja",
              label: "Tipe Unit Kerja",
              type: "select",
              options: ["Kantor Cabang", "KCP", "BRI Unit", "Teras BRI"],
              required: true,
            },
            {
              key: "akses_level",
              label: "Akses Level",
              type: "select",
              options: jobAccessLevelLabels,
              required: true,
            },

            { key: "keterangan", label: "Keterangan", type: "textarea", required: true },
          ]}
        />
      ) : (
        <AccessDenied />
      )}
    </AdminLayout>
  );
}
