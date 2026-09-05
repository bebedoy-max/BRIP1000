import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/components/AdminLayout";
import { TutorialGuide } from "@/components/TutorialGuide";

export const Route = createFileRoute("/_authenticated/admin/tutorial")({
  head: () => ({
    meta: [
      { title: "Tutorial & Panduan — Panel BRI BO Pringsewu" },
      {
        name: "description",
        content: "Panduan tata cara penggunaan seluruh menu dan fitur aplikasi internal.",
      },
      { property: "og:title", content: "Tutorial & Panduan — Panel BRI BO Pringsewu" },
      {
        property: "og:description",
        content: "Panduan tata cara penggunaan seluruh menu dan fitur aplikasi internal.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AdminPage menuKey="tutorial">
      <TutorialGuide />
    </AdminPage>
  );
}
