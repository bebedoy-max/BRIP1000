import { createFileRoute } from "@tanstack/react-router";
import { AdminLayout, AccessDenied } from "@/components/AdminLayout";
import { ProjectManager } from "@/components/ProjectManager";
import { useRoles } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/admin/project")({
  head: () => ({
    meta: [
      { title: "Project IT — Panel BRI BO Pringsewu" },
      { name: "description", content: "Kelola project IT beserta parameter pencapaian dan deadline." },
      { property: "og:title", content: "Project IT — Panel BRI BO Pringsewu" },
      { property: "og:description", content: "Daftar project IT, parameter pencapaian, tanggal mulai, dan deadline." },
    ],
  }),
  component: Page,
});

function Page() {
  const r = useRoles();
  return (
    <AdminLayout>
      {r.loading ? null : r.isItAdmin ? <ProjectManager canWrite={r.isItAdmin} /> : <AccessDenied />}
    </AdminLayout>
  );
}
