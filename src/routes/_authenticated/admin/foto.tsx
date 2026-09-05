import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout, AccessDenied } from "@/components/AdminLayout";
import { EventGalleryBrowser } from "@/components/EventGalleryBrowser";
import { useRoles } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/admin/foto")({
  head: () => ({
    meta: [
      { title: "Event — Panel BRI BO Pringsewu" },
      { name: "description", content: "Galeri dokumentasi foto event hasil proses face recognition." },
      { property: "og:title", content: "Event — Panel BRI BO Pringsewu" },
      {
        property: "og:description",
        content: "Galeri dokumentasi foto event hasil proses face recognition.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  const r = useRoles();
  return (
    <AdminLayout>
      {r.loading ? null : r.session ? (
        <EventGalleryBrowser />
      ) : (
        <AccessDenied />
      )}
    </AdminLayout>
  );
}
