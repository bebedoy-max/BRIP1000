import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout, AccessDenied } from "@/components/AdminLayout";
import { ResourceManager } from "@/components/ResourceManager";
import { useRoles } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/admin/uker")({
  head: () => ({
    meta: [
      { title: "Unit Kerja — Panel BRI BO Pringsewu" },
      { name: "description", content: "Data kode uker, lokasi, titik maps, dan IP address." },
      { property: "og:title", content: "Unit Kerja — Panel BRI BO Pringsewu" },
      { property: "og:description", content: "Data kode uker, lokasi, titik maps, dan IP address." },
    ],
  }),
  component: Page,
});

function Page() {
  const r = useRoles();
  const allowed = true;
  return (
    <AdminLayout>
      {r.loading ? null : allowed ? (
        <ResourceManager
          table="ukers"
          title="Unit Kerja"
          description="Data kode uker, tipe kantor, alamat, titik maps, dan IP address."
          canWrite={r.isItAdmin}
          photoEntity="uker"
          fields={[
            {
              key: "kode_uker",
              label: "Kode Uker",
              type: "digits",
              digitsLength: 4,
              required: true,
              unique: true,
              placeholder: "4 digit angka",
            },
            { key: "nama_uker", label: "Nama Uker", required: true },
            {
              key: "tipe",
              label: "Tipe Kantor",
              type: "select",
              options: ["Kantor Cabang", "KCP", "BRI Unit", "Teras BRI"],
              required: true,
            },
            { key: "alamat", label: "Alamat", type: "textarea", required: true },
            {
              key: "deskripsi",
              label: "Deskripsi Profil Uker",
              type: "textarea",
              placeholder: "Deskripsi singkat profil unit kerja",
            },
            {
              key: "titik_maps",
              label: "Titik Maps",
              type: "latlng",
              placeholder: "isi dengan format latitude longitude contoh : -5.355185, 104.973334",
            },
            {
              key: "ip_address",
              label: "IP Address",
              type: "ip",
              required: true,
              placeholder: "format xxx.xxx.xxx.xxx isi hanya angka saja",
            },
          ]}
        />
      ) : (
        <AccessDenied />
      )}
    </AdminLayout>
  );
}
