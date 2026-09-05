import { createFileRoute, Link, useParams, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ArrowLeft, Lock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PublicLayout } from "@/components/PublicLayout";
import { Button } from "@/components/ui/button";
import { useDetailAccess } from "@/lib/access";
import { findPublicDetail } from "@/lib/public-detail";
import { MapsLink } from "@/components/MapsLink";
import { UkerProfileLink } from "@/components/UkerProfileLink";
import { EmployeeProfileLink } from "@/components/EmployeeProfileLink";
import { MachineProfileLink } from "@/components/MachineProfileLink";
import { PhotoGallery } from "@/components/PhotoGallery";
import { Images } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import { useProjectSummary } from "@/components/ProjectSummary";

const db = supabase as unknown as SupabaseClient;

export const Route = createFileRoute("/detail/$key")({
  validateSearch: (search: Record<string, unknown>): {
    from?: string;
    q?: string;
    focus?: string;
  } => {
    const out: { from?: string; q?: string; focus?: string } = {};
    if (typeof search["from"] === "string") out.from = search["from"];
    if (typeof search["q"] === "string") out.q = search["q"];
    if (typeof search["focus"] === "string") out.focus = search["focus"];
    return out;
  },
  head: () => ({
    meta: [
      { title: "Detail Data — BRI BO Pringsewu" },
      {
        name: "description",
        content:
          "Rincian data unit kerja, mesin ATM, mesin EDC, pegawai, dan project IT BRI Branch Office Pringsewu.",
      },
      { property: "og:title", content: "Detail Data — BRI BO Pringsewu" },
      {
        property: "og:description",
        content: "Rincian data operasional BRI Branch Office Pringsewu sesuai hak akses.",
      },
    ],
  }),
  component: DetailPage,
});

const fmt = (v: unknown) => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Ya" : "Tidak";
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s).toLocaleDateString("id-ID", { dateStyle: "medium" });
  return s;
};

function DetailPage() {
  const { key } = useParams({ from: "/detail/$key" });
  const cfg = findPublicDetail(key);
  const access = useDetailAccess(cfg?.menuKey ?? key);

  const rows = useQuery({
    queryKey: ["public-detail", key],
    enabled: !!cfg && access.allowed,
    queryFn: async () => {
      const sources = cfg!.sources ?? [{ table: cfg!.table, jenis: "" }];
      const all: Record<string, unknown>[] = [];
      for (const src of sources) {
        const { data, error } = await db.from(src.table).select("*").limit(500);
        if (error) throw error;
        for (const row of (data ?? []) as Record<string, unknown>[]) {
          all.push(src.jenis ? { ...row, jenis_mesin: src.jenis } : row);
        }
      }
      const ob = cfg!.orderBy;
      if (ob) all.sort((a, b) => String(a[ob] ?? "").localeCompare(String(b[ob] ?? "")));
      return all;
    },
  });

  if (!cfg) {
    return (
      <PublicLayout>
        <BackLink />
        <h1 className="mt-4 text-2xl font-bold">Data tidak dikenal</h1>
        <p className="mt-1 text-sm text-muted-foreground">Halaman detail ini tidak tersedia.</p>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <BackLink />
      <h1 className="mt-4 text-2xl font-bold">
        <span className="gradient-text">{cfg.title}</span>
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{cfg.description}</p>

      {access.loading ? (
        <p className="mt-8 text-sm text-muted-foreground">Memeriksa hak akses…</p>
      ) : !access.allowed ? (
        <section className="glass-card mt-6 flex flex-col items-start gap-3 p-8">
          <span className="grid size-12 place-items-center rounded-2xl bg-secondary">
            <Lock className="size-5 text-muted-foreground" />
          </span>
          <h2 className="text-lg font-semibold">Detail terkunci</h2>
          <p className="max-w-xl text-sm text-muted-foreground">
            {access.loggedIn
              ? "Level akses Anda belum diizinkan melihat rincian data ini. Hubungi Super Admin untuk meminta akses."
              : "Rincian data ini hanya dapat dilihat setelah masuk. Pengaturan data yang boleh dilihat pengunjung umum dikelola pada menu Akses Halaman."}
          </p>
          {!access.loggedIn ? (
            <Button asChild className="mt-1">
              <Link to="/auth">Masuk untuk melihat</Link>
            </Button>
          ) : null}
        </section>
      ) : rows.isLoading ? (
        <p className="mt-8 text-sm text-muted-foreground">Memuat data…</p>
      ) : rows.isError ? (
        <p className="mt-8 text-sm text-muted-foreground">Data tidak dapat dimuat.</p>
      ) : (rows.data ?? []).length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">Belum ada data.</p>
      ) : (
        <DetailTable cfg={cfg} rows={rows.data ?? []} />
      )}
    </PublicLayout>
  );
}

function DetailTable({
  cfg,
  rows,
}: {
  cfg: NonNullable<ReturnType<typeof findPublicDetail>>;
  rows: Record<string, unknown>[];
}) {
  const [photoRow, setPhotoRow] = useState<Record<string, unknown> | null>(null);
  const showPhotoCol = !!cfg.photoEntity && !cfg.hidePhotoColumn;
  const fromPath = useRouterState({ select: (st) => st.location.pathname });
  const sample = rows[0] ?? {};
  const cols = cfg.columns.filter((c) => c.key in sample || c.type === "progress");
  const columns = cols.length
    ? cols
    : Object.keys(sample)
        .filter((k) => !["id", "created_at", "updated_at"].includes(k))
        .slice(0, 5)
        .map((k) => ({ key: k, label: k.replace(/_/g, " "), type: undefined }));

  const mobileKeys = cfg.mobileColumns;
  const colClass = (c: { key: string; mobileOnly?: boolean }) => {
    if (c.mobileOnly) return "md:hidden";
    if (mobileKeys && !mobileKeys.includes(c.key)) return "hidden md:table-cell";
    return "";
  };

  return (
    <div className="glass-card mt-6 overflow-x-auto p-1">
      <table className="w-full min-w-0 md:min-w-[640px] border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th
                key={c.key}
                className={`bg-secondary/40 p-3 text-left font-semibold capitalize backdrop-blur-xl ${colClass(c)} ${
                  i === 0 ? "rounded-tl-xl" : ""
                } ${i === columns.length - 1 ? "rounded-tr-xl" : ""}`}
              >
                {c.label}
              </th>
            ))}
            {showPhotoCol ? (
              <th
                className={`bg-secondary/40 p-3 text-left font-semibold backdrop-blur-xl ${
                  mobileKeys ? "hidden md:table-cell" : ""
                }`}
              >
                Foto
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={String(r["id"] ?? idx)} className="transition-colors hover:bg-secondary/20">
              {columns.map((c) => (
                <td key={c.key} className={`border-t border-border/40 p-3 align-top ${colClass(c)}`}>
                  {c.type === "progress" ? (
                    <ProgressCell projectId={String(r["id"] ?? "")} />
                  ) : c.type === "machinename" ? (
                    <MachineProfileLink
                      machineId={String(r["id"] ?? "")}
                      lokasi={String(r[c.key] ?? "—")}
                      jenis={String(r["jenis_mesin"] ?? "ATM")}
                    />
                  ) : c.type === "empname" ? (
                    <EmployeeProfileLink
                      employeeId={String(r["id"] ?? "")}
                      nama={String(r[c.key] ?? "—")}
                    />
                  ) : c.type === "ukername" ? (
                    <UkerProfileLink
                      ukerId={String(r["id"] ?? "")}
                      nama={String(r[c.key] ?? "—")}
                      kode={r["kode_uker"] ? String(r["kode_uker"]) : undefined}
                      tipe={r["tipe"] as string | null}
                      deskripsi={r["deskripsi"] as string | null}
                    />
                  ) : c.type === "latlng" ? (
                    <MapsLink
                      value={r[c.key]}
                      name={(cfg.nameParts
                        ? cfg.nameParts
                            .map((p) => String(r[p] ?? "").trim())
                            .filter(Boolean)
                            .join(" ")
                        : cfg.nameColumn
                          ? String(r[cfg.nameColumn] ?? "")
                          : "") || undefined}
                      photoEntity={cfg.photoEntity}
                      entityId={String(r["id"] ?? "")}
                    />
                  ) : c.type === "link" && c.linkTo ? (
                    <Link
                      to={c.linkTo as "/project/$id" | "/event/$id"}
                      params={{ [c.linkParamName ?? "id"]: String(r[c.linkParamField ?? "id"] ?? "") } as { id: string }}
                      search={{ from: fromPath }}
                      className="font-medium text-primary underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      {fmt(r[c.key])}
                    </Link>
                  ) : (
                    fmt(r[c.key])
                  )}
                </td>
              ))}
              {showPhotoCol ? (
                <td
                  className={`border-t border-border/40 p-3 align-top ${
                    mobileKeys ? "hidden md:table-cell" : ""
                  }`}
                >
                  <Button size="sm" variant="ghost" onClick={() => setPhotoRow(r)}>
                    <Images className="size-4" /> Lihat
                  </Button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="p-3 text-xs text-muted-foreground">{rows.length} data ditampilkan.</p>

      {showPhotoCol ? (
        <Dialog open={!!photoRow} onOpenChange={(v) => !v && setPhotoRow(null)}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Galeri Foto — {cfg.title}</DialogTitle>
            </DialogHeader>
            {photoRow ? (
              <PhotoGallery
                entity={cfg.photoEntity!}
                entityId={String(photoRow["id"] ?? "")}
                title="Foto tersimpan di Google Drive"
              />
            ) : null}
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

function ProgressCell({ projectId }: { projectId: string }) {
  const q = useProjectSummary();
  const row = (q.data ?? []).find((p) => p.id === projectId);
  if (!row) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="min-w-24">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="tabular-nums font-semibold text-foreground">{row.pct}%</span>
        <span className="text-muted-foreground">
          {row.done}/{row.total}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary" style={{ width: `${row.pct}%` }} />
      </div>
    </div>
  );
}

function BackLink() {
  const { from } = Route.useSearch();
  const target = from && from.startsWith("/") && !from.startsWith("//") ? from : "/";
  const label = target.startsWith("/admin") ? "Kembali ke panel" : "Kembali ke dashboard";
  return (
    <Link
      to={target as "/"}
      className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> {label}
    </Link>
  );
}
