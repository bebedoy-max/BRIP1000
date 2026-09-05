import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout, AccessDenied } from "@/components/AdminLayout";
import { ResourceManager } from "@/components/ResourceManager";
import { useRoles } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/admin/ip")({
  head: () => ({
    meta: [
      { title: "IP Address Uker — Panel BRI BO Pringsewu" },
      { name: "description", content: "Data IP address per unit kerja, terbatas untuk IT Admin." },
      { property: "og:title", content: "IP Address Uker — Panel BRI BO Pringsewu" },
      { property: "og:description", content: "Data jaringan unit kerja BRI BO Pringsewu." },
    ],
  }),
  component: Page,
});

function Page() {
  const { isItAdmin, loading } = useRoles();
  return (
    <AdminLayout>
      {loading ? null : isItAdmin ? (
        <ResourceManager
          table="ukers"
          title="IP Address Unit Kerja"
          description="Data sensitif — hanya terlihat oleh IT Admin dan Superadmin."
          fields={[
            { key: "kode_uker", label: "Kode Uker", hideInForm: true },
            { key: "nama_uker", label: "Nama Uker", hideInForm: true },
            { key: "ip_address", label: "IP Address" },
            { key: "pic_it", label: "PIC IT" },
          ]}
        />
      ) : (
        <AccessDenied />
      )}
    </AdminLayout>
  );
}