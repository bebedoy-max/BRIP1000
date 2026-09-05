import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout, AccessDenied } from "@/components/AdminLayout";
import { ResourceManager } from "@/components/ResourceManager";
import { useRoles } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/admin/perangkat")({
  head: () => ({
    meta: [
      { title: "Data Perangkat IT — Panel BRI BO Pringsewu" },
      { name: "description", content: "Data perangkat IT: PC, laptop, printer, router, dan lainnya beserta penggunanya." },
      { property: "og:title", content: "Data Perangkat IT — Panel BRI BO Pringsewu" },
      { property: "og:description", content: "Daftar perangkat IT, pengguna, IP address, dan kondisi perangkat." },
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
          table="it_devices"
          title="Data Perangkat IT"
          description="Daftar perangkat IT beserta pengguna, IP address, dan kondisinya."
          canWrite={r.isItAdmin}
          photoEntity="perangkat"
          fields={[
            { key: "nama_perangkat", label: "Nama Perangkat", required: true },
            {
              key: "jenis_id",
              label: "Jenis Perangkat",
              type: "ref",
              refTable: "device_types",
              refLabelColumn: "jenis_perangkat",
              required: true,
            },
            {
              key: "pengguna_id",
              label: "Nama Pengguna",
              type: "reftext",
              refTable: "employees",
              refLabelColumn: "nama",
              textColumn: "nama_pengguna",
              placeholder: "Ketik nama pengguna…",
              required: true,
            },

            {
              key: "uker_id",
              label: "Unit Kerja",
              type: "uker",
              required: true,
              autoFill: { fromField: "pengguna_id", column: "uker_id" },
            },
            { key: "merk", label: "Merk" },
            { key: "serial_number", label: "Serial Number" },
            { key: "ip_address", label: "IP Address", placeholder: "contoh: 10.10.1.25" },
            { key: "processor", label: "Processor" },
            { key: "ram", label: "RAM" },
            {
              key: "storage_type",
              label: "SSD/HDD",
              type: "select",
              options: ["SSD", "HDD"],
            },
            {
              key: "kondisi_perangkat",
              label: "Kondisi",
              type: "select",
              required: true,
              options: ["Baik", "Rusak"],
            },
            { key: "keterangan", label: "Keterangan", type: "textarea", hideInTable: true },
          ]}

        />
      ) : (
        <AccessDenied />
      )}
    </AdminLayout>
  );
}
