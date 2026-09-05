import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout, AccessDenied } from "@/components/AdminLayout";
import { ResourceManager } from "@/components/ResourceManager";
import { useRoles } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/admin/edc")({
  head: () => ({
    meta: [
      { title: "Mesin EDC — Panel BRI BO Pringsewu" },
      { name: "description", content: "Daftar mesin EDC dan merchant terpasang." },
      { property: "og:title", content: "Mesin EDC — Panel BRI BO Pringsewu" },
      { property: "og:description", content: "Daftar mesin EDC dan merchant terpasang." },
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
          table="edc_machines"
          title="Mesin EDC"
          description="Daftar mesin EDC dan merchant terpasang."
          canWrite={r.isItAdmin}
          photoEntity="edc"
          fields={[
            { key: "tid", label: "TID", type: "digits", required: true, unique: true },
            { key: "nama_merchant", label: "Nama Merchant", required: true },
            {
              key: "kategori_edc",
              label: "Kategori EDC",
              type: "select",
              options: ["Merchant", "Brilink", "UKO"],
              required: true,
            },
            { key: "alamat", label: "Alamat", type: "textarea", required: true },
            {
              key: "koordinat",
              label: "Longitude, Latitude",
              placeholder: "Contoh: 104.5655289, -5.30274868",
            },
            {
              key: "no_telp",
              label: "Nomor Telepon",
              placeholder: "Contoh: 0812-3456-7890",
            },
            { key: "keterangan", label: "Keterangan", type: "textarea" },
          ]}
        />
      ) : (
        <AccessDenied />
      )}
    </AdminLayout>
  );
}
