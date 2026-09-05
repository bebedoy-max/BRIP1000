import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout, AccessDenied } from "@/components/AdminLayout";
import { ResourceManager } from "@/components/ResourceManager";
import { useRoles } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/admin/atm")({
  head: () => ({
    meta: [
      { title: "Mesin ATM — Panel BRI BO Pringsewu" },
      { name: "description", content: "Daftar mesin ATM beserta jadwal maintenance." },
      { property: "og:title", content: "Mesin ATM — Panel BRI BO Pringsewu" },
      { property: "og:description", content: "Daftar mesin ATM beserta jadwal maintenance." },
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
          table="atm_machines"
          title="Mesin ATM"
          description="Daftar mesin ATM beserta jadwal maintenance."
          canWrite={r.isItAdmin}
          photoEntity="atm"
          fields={[
            { key: "tid", label: "TID", type: "digits", required: true, unique: true },
            { key: "lokasi", label: "Lokasi", required: true },
            {
              key: "titik_maps",
              label: "Titik Maps",
              type: "latlng",
              placeholder: "isi dengan format latitude longitude contoh : -5.355185, 104.973334",
            },
            { key: "merk", label: "Merk ATM", required: true },
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
      ) : (
        <AccessDenied />
      )}
    </AdminLayout>
  );
}
