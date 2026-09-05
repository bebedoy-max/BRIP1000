import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout, AccessDenied } from "@/components/AdminLayout";
import { ResourceManager } from "@/components/ResourceManager";
import { useRoles } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/admin/aset")({
  head: () => ({
    meta: [
      { title: "Inventaris Aset — Panel BRI BO Pringsewu" },
      { name: "description", content: "Inventaris aset IT: laptop, printer, router, dan lainnya." },
      { property: "og:title", content: "Inventaris Aset — Panel BRI BO Pringsewu" },
      { property: "og:description", content: "Inventaris aset IT: laptop, printer, router, dan lainnya." },
    ],
  }),
  component: Page,
});

function Page() {
  const r = useRoles();
  const allowed = r.isItAdmin;
  return (
    <AdminLayout>
      {r.loading ? null : allowed ? (
        <ResourceManager
          table="assets"
          title="Inventaris Aset"
          description="Inventaris aset IT: laptop, printer, router, dan lainnya."
          canWrite={r.isItAdmin}
          fields={[
            { key: "nama_aset", label: "Nama Aset" },
            { key: "kategori", label: "Kategori", type: "select", options: ["Laptop", "Desktop", "Printer", "Router", "Switch", "Server", "Lainnya"] },
            { key: "uker_id", label: "Unit Kerja", type: "uker" },
            { key: "serial_number", label: "Serial Number" },
            { key: "tanggal_beli", label: "Tgl Beli", type: "date" },
            { key: "status", label: "Status", type: "select", options: ["baik", "perbaikan", "rusak", "dihapuskan"] },
            { key: "catatan_perbaikan", label: "Catatan Perbaikan", type: "textarea", hideInTable: true },
          ]}
        />
      ) : (
        <AccessDenied />
      )}
    </AdminLayout>
  );
}
