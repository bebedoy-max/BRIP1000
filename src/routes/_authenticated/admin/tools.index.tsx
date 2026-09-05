import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { AdminPage } from "@/components/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { superItApps } from "@/lib/superit-apps";


export const Route = createFileRoute("/_authenticated/admin/tools/")({
  head: () => ({
    meta: [
      { title: "SuperIT Apps — Panel BRI BO Pringsewu" },
      {
        name: "description",
        content: "Kumpulan aplikasi tambahan panel: absensi event, vote, undian, dan nomination.",
      },
      { property: "og:title", content: "SuperIT Apps — Panel BRI BO Pringsewu" },
      {
        property: "og:description",
        content: "Kumpulan aplikasi tambahan panel BRI BO Pringsewu.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

const apps = superItApps;


function Page() {
  return (
    <AdminPage menuKey="tools">
      <div className="space-y-5">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Sparkles className="size-6" /> SuperIT Apps
          </h1>
          <p className="text-sm text-muted-foreground">
            Aplikasi tambahan (add-ins) yang berjalan di dalam panel: absensi event, vote, undian,
            nomination, dan lainnya.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {apps.map((app) =>
            app.ready && app.to ? (
              <Link key={app.key} to={app.to} className="glass-card block space-y-2 p-5 transition hover:opacity-90">
                <div className="flex items-center justify-between">
                  <app.icon className="size-6" />
                  <Badge>Aktif</Badge>
                </div>
                <h2 className="font-semibold">{app.label}</h2>
                <p className="text-sm text-muted-foreground">{app.description}</p>
              </Link>
            ) : (
              <div key={app.key} className="glass-card space-y-2 p-5 opacity-60">
                <div className="flex items-center justify-between">
                  <app.icon className="size-6" />
                  <Badge variant="secondary">Segera</Badge>
                </div>
                <h2 className="font-semibold">{app.label}</h2>
                <p className="text-sm text-muted-foreground">{app.description}</p>
              </div>
            ),
          )}
        </div>
      </div>
    </AdminPage>
  );
}
