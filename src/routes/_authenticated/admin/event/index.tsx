import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { AdminLayout, AccessDenied } from "@/components/AdminLayout";
import { ResourceManager } from "@/components/ResourceManager";
import { Button } from "@/components/ui/button";
import { useRoles } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/admin/event/")({
  head: () => ({
    meta: [
      { title: "Event & Absensi — Panel BRI BO Pringsewu" },
      { name: "description", content: "Kelola event kantor, link absensi, dan laporan kehadiran." },
      { property: "og:title", content: "Event & Absensi — Panel BRI BO Pringsewu" },
      { property: "og:description", content: "Kelola event dan laporan kehadiran BRI BO Pringsewu." },
    ],
  }),
  component: Page,
});

function Page() {
  const { isEventAdmin, loading } = useRoles();
  return (
    <AdminLayout>
      {loading ? null : isEventAdmin ? (
        <ResourceManager
          table="events"
          title="Event & Absensi"
          description="Buat event, bagikan link/QR absensi, dan unduh laporan kehadiran."
          ownerColumn="created_by"
          fields={[
            { key: "nama_event", label: "Nama Event" },
            { key: "deskripsi", label: "Deskripsi", type: "textarea", hideInTable: true },
            { key: "tanggal_mulai", label: "Mulai", type: "datetime" },
            { key: "tanggal_selesai", label: "Selesai", type: "datetime" },
            { key: "qr_token", label: "Token QR", hideInForm: true },
            { key: "is_active", label: "Status", type: "boolean" },
          ]}
          extraActions={(row) => (
            <Button asChild size="sm" variant="secondary">
              <Link to="/admin/event/$id" params={{ id: String(row["id"]) }}>
                <ExternalLink className="size-4" /> Detail
              </Link>
            </Button>
          )}
        />
      ) : (
        <AccessDenied />
      )}
    </AdminLayout>
  );
}