import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/components/AdminLayout";
import { ResourceManager } from "@/components/ResourceManager";
import { useRoles } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/admin/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda Upcoming Event — Panel BRI BO Pringsewu" },
      {
        name: "description",
        content: "Pengaturan agenda kegiatan mendatang yang tampil pada kolom Upcoming Event dashboard umum.",
      },
      { property: "og:title", content: "Agenda Upcoming Event — Panel BRI BO Pringsewu" },
      {
        property: "og:description",
        content: "Pengaturan agenda kegiatan mendatang yang tampil pada dashboard umum.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  const r = useRoles();
  return (
    <AdminPage menuKey="agenda">
      {r.loading ? null : (
        <ResourceManager
          table="agenda"
          title="Agenda Upcoming Event"
          description="Agenda kegiatan mendatang yang tampil pada kolom Upcoming Event di dashboard umum."
          canWrite={r.isItAdmin}
          fields={[
            { key: "judul", label: "Nama Kegiatan", required: true },
            { key: "tanggal", label: "Tanggal", type: "date", required: true },
            { key: "waktu", label: "Waktu (mis. 08.00 WIB)" },
            { key: "lokasi", label: "Lokasi" },
            { key: "keterangan", label: "Keterangan", type: "textarea" },
            { key: "aktif", label: "Tampilkan", type: "boolean" },
          ]}
        />
      )}
    </AdminPage>
  );
}
