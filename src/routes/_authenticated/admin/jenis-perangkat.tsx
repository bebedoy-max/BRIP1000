import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout, AccessDenied } from "@/components/AdminLayout";
import { ResourceManager } from "@/components/ResourceManager";
import { useRoles } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/admin/jenis-perangkat")({
  head: () => ({
    meta: [
      { title: "Jenis Perangkat — Panel BRI BO Pringsewu" },
      { name: "description", content: "Master data jenis perangkat IT beserta level fungsinya." },
      { property: "og:title", content: "Jenis Perangkat — Panel BRI BO Pringsewu" },
      {
        property: "og:description",
        content: "Master data jenis perangkat IT beserta deskripsi dan level fungsinya.",
      },
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
          table="device_types"
          title="Jenis Perangkat"
          description="Master data jenis perangkat yang dipakai pada menu Data Perangkat IT."
          canWrite={r.isItAdmin}
          fields={[
            { key: "jenis_perangkat", label: "Jenis Perangkat", required: true },
            { key: "deskripsi", label: "Deskripsi", type: "textarea" },
            {
              key: "level_fungsi",
              label: "Level Fungsi",
              type: "select",
              options: ["Perangkat Utama", "Perangkat Tambahan", "Perangkat Lainnya"],
              required: true,
            },
          ]}
        />
      ) : (
        <AccessDenied />
      )}
    </AdminLayout>
  );
}
