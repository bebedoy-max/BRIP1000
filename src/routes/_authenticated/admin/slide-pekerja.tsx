import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/components/AdminLayout";
import { WorkerSliderManager } from "@/components/WorkerSliderManager";
import { useRoles } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/admin/slide-pekerja")({
  head: () => ({
    meta: [
      { title: "Slide Profil Pekerja — Panel BRI BO Pringsewu" },
      {
        name: "description",
        content:
          "Atur pekerja yang tampil pada kolom slide profil dashboard beserta warna pulse glow frame fotonya.",
      },
      { property: "og:title", content: "Slide Profil Pekerja — Panel BRI BO Pringsewu" },
      {
        property: "og:description",
        content: "Pengaturan slide profil pekerja pada dashboard BRI BO Pringsewu.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  const r = useRoles();
  return (
    <AdminPage menuKey="slide-pekerja">
      {r.loading ? null : <WorkerSliderManager canWrite={r.isItAdmin} />}
    </AdminPage>
  );
}
