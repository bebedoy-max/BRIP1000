import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/components/AdminLayout";
import { InfoBoardManager } from "@/components/InfoBoardManager";
import { useRoles } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/admin/papan-informasi")({
  head: () => ({
    meta: [
      { title: "Papan Informasi — Panel BRI BO Pringsewu" },
      {
        name: "description",
        content:
          "Kelola konten papan informasi digital (teks, gambar, video) yang tampil pada dashboard BRI BO Pringsewu.",
      },
      { property: "og:title", content: "Papan Informasi — Panel BRI BO Pringsewu" },
      {
        property: "og:description",
        content: "Input konten papan informasi digital beserta durasi dan efek transisinya.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  const r = useRoles();
  return (
    <AdminPage menuKey="papan-informasi">
      {r.loading ? null : <InfoBoardManager canWrite={r.isItAdmin} />}
    </AdminPage>
  );
}
