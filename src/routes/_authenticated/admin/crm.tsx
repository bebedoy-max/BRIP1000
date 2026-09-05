import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout, AccessDenied } from "@/components/AdminLayout";
import { ResourceManager } from "@/components/ResourceManager";
import { useRoles } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/admin/crm")({
  head: () => ({
    meta: [
      { title: "Mesin CRM — Panel BRI BO Pringsewu" },
      { name: "description", content: "Daftar mesin CRM beserta lokasi, IP address, dan tanggal live." },
      { property: "og:title", content: "Mesin CRM — Panel BRI BO Pringsewu" },
      { property: "og:description", content: "Daftar mesin CRM beserta lokasi, IP address, dan tanggal live." },
    ],
  }),
  component: Page,
});

function Page() {
  const r = useRoles();
  return (
    <AdminLayout>
      {r.loading ? null : (
        <ResourceManager
          table="crm_machines"
          title="Mesin CRM"
          description="Daftar mesin CRM beserta lokasi, IP address, dan tanggal live."
          canWrite={r.isItAdmin}
          photoEntity="crm"
          fields={[
            { key: "tid", label: "TID", type: "digits", required: true, unique: true },
            { key: "lokasi", label: "Lokasi", required: true },
            {
              key: "titik_maps",
              label: "Titik Maps",
              type: "latlng",
              placeholder: "isi dengan format latitude longitude contoh : -5.355185, 104.973334",
            },
            { key: "merk", label: "Merk CRM", required: true },
            {
              key: "ip_address",
              label: "IP Address",
              type: "ip",
              required: true,
              placeholder: "format xxx.xxx.xxx.xxx isi hanya angka saja",
            },
            { key: "tgl_live", label: "Tgl. Live", type: "date" },
          ]}
        />
      )}
    </AdminLayout>
  );
}
