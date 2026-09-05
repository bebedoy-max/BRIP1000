import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/components/AdminLayout";
import { CarouselManager } from "@/components/CarouselManager";
import { useRoles } from "@/lib/roles";


export const Route = createFileRoute("/_authenticated/admin/carousel")({
  head: () => ({
    meta: [
      { title: "Konten Carousel — Panel BRI BO Pringsewu" },
      {
        name: "description",
        content:
          "Pengaturan bagian konten yang ditampilkan pada kolom carousel dashboard umum BRI BO Pringsewu.",
      },
      { property: "og:title", content: "Konten Carousel — Panel BRI BO Pringsewu" },
      {
        property: "og:description",
        content: "Atur sumber konten dan jumlah slide pada carousel dashboard umum.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  const r = useRoles();
  return (
    <AdminPage menuKey="carousel">
      {r.loading ? null : <CarouselManager canWrite={r.isItAdmin} />}

    </AdminPage>
  );
}
