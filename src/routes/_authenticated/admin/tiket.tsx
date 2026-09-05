import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/components/AdminLayout";
import { TicketManager } from "@/components/TicketManager";

export const Route = createFileRoute("/_authenticated/admin/tiket")({
  head: () => ({
    meta: [
      { title: "Tiket IT — Panel BRI BO Pringsewu" },
      { name: "description", content: "Tiket dan keluhan IT internal per unit kerja." },
      { property: "og:title", content: "Tiket IT — Panel BRI BO Pringsewu" },
      { property: "og:description", content: "Pelaporan dan penanganan keluhan IT internal." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AdminPage menuKey="tiket">
      <TicketManager />
    </AdminPage>
  );
}
