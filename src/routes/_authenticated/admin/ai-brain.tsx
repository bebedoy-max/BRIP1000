import { createFileRoute } from "@tanstack/react-router";
import { AdminPage } from "@/components/AdminLayout";
import { AiBrainManager } from "@/components/AiBrainManager";

export const Route = createFileRoute("/_authenticated/admin/ai-brain")({
  head: () => ({
    meta: [
      { title: "AI Brain — Panel BRI BO Pringsewu" },
      {
        name: "description",
        content: "Kelola koneksi AI (Gemini, OpenAI, Claude) yang dipakai aplikasi internal.",
      },
      { property: "og:title", content: "AI Brain — Panel BRI BO Pringsewu" },
      {
        property: "og:description",
        content: "Kelola koneksi AI (Gemini, OpenAI, Claude) yang dipakai aplikasi internal.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AdminPage menuKey="ai-brain">
      <AiBrainManager />
    </AdminPage>
  );
}
