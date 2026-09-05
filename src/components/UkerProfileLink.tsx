import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Building2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { PhotoGallery } from "@/components/PhotoGallery";
import { MapsLink } from "@/components/MapsLink";
import { EmployeeProfileLink } from "@/components/EmployeeProfileLink";

const db = supabase as unknown as SupabaseClient;

/** Urutan jabatan pada profil uker, disesuaikan tipe kantor. */
const orderByTipe: Record<string, string[]> = {
  "BRI Unit": ["Kepala Unit", "SOL", "Mantri", "Customer Service", "Teller"],
  KCP: ["Pincapem", "SOL", "RM", "Customer Service", "Teller"],
  "Kantor Cabang": [
    "Pemimpin Cabang",
    "AMOL",
    "Manager Bisnis Mikro",
    "SBM",
    "SPO",
    "SOK",
    "SOL",
    "RM",
    "Customer Service",
    "Teller",
  ],
};

function rank(jabatan: string, tipe: string | null | undefined) {
  const order = orderByTipe[String(tipe ?? "")] ?? [];
  const j = jabatan.trim().toLowerCase();
  const i = order.findIndex((o) => {
    const k = o.toLowerCase();
    return j === k || j.startsWith(k) || j.includes(k);
  });
  return i === -1 ? order.length + 1 : i;
}

type Worker = { id: string; nama: string; jabatan: string };

/** Nama uker yang bisa diklik: membuka pop up profil unit kerja. */
export function UkerProfileLink({
  ukerId,
  nama,
  kode,
  tipe,
  deskripsi,
}: {
  ukerId: string;
  nama: string;
  kode?: string | undefined;
  tipe?: string | null | undefined;
  deskripsi?: string | null | undefined;
}) {
  const [open, setOpen] = useState(false);

  const detail = useQuery<Record<string, unknown> | null>({
    queryKey: ["uker-profile-detail", ukerId],
    enabled: open && !!ukerId,
    queryFn: async () => {
      const { data, error } = await db
        .from("ukers")
        .select("alamat,titik_maps,deskripsi,updated_at,created_at")
        .eq("id", ukerId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as Record<string, unknown> | null;
    },
  });

  const workers = useQuery<Worker[]>({
    queryKey: ["uker-profile-workers", ukerId],
    enabled: open && !!ukerId,
    queryFn: async () => {
      const { data, error } = await db
        .from("employees")
        .select("id,nama,jabatan_id")
        .eq("uker_id", ukerId);
      if (error) throw error;
      const rows = (data ?? []) as Record<string, unknown>[];
      const ids = [...new Set(rows.map((r) => String(r["jabatan_id"] ?? "")).filter(Boolean))];
      const titles = new Map<string, string>();
      if (ids.length) {
        const { data: jt } = await db.from("job_titles").select("id,nama_jabatan").in("id", ids);
        for (const t of (jt ?? []) as Record<string, unknown>[])
          titles.set(String(t["id"]), String(t["nama_jabatan"] ?? ""));
      }
      const list: Worker[] = rows.map((r) => ({
        id: String(r["id"]),
        nama: String(r["nama"] ?? ""),
        jabatan: titles.get(String(r["jabatan_id"] ?? "")) ?? "—",
      }));
      list.sort((a, b) => {
        const d = rank(a.jabatan, tipe) - rank(b.jabatan, tipe);
        if (d !== 0) return d;
        const j = a.jabatan.localeCompare(b.jabatan, "id");
        return j !== 0 ? j : a.nama.localeCompare(b.nama, "id");
      });
      return list;
    },
  });

  const row = detail.data ?? {};
  const profil = (deskripsi?.trim() ? deskripsi : String(row["deskripsi"] ?? "")).trim();
  const alamat = String(row["alamat"] ?? "").trim();
  const maps = row["titik_maps"];
  const updatedRaw = String(row["updated_at"] ?? row["created_at"] ?? "");
  const updated = updatedRaw
    ? new Date(updatedRaw).toLocaleDateString("id-ID", { dateStyle: "medium" })
    : "—";

  const list = workers.data ?? [];
  const half = Math.ceil(list.length / 2);
  const columnsWorkers = [list.slice(0, half), list.slice(half)];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-left text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label={`Lihat profil ${nama}`}
      >
        <Building2 className="size-3.5 shrink-0" />
        <span>{nama}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-extrabold tracking-tight uppercase">
              {nama}
              {kode ? ` (${kode})` : ""}
            </DialogTitle>
            <DialogDescription className="sr-only">Profil unit kerja</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <dl className="space-y-2">
              <Field label="Alamat">{alamat || "—"}</Field>
              <Field label="Titik Maps">
                <MapsLink
                  value={maps}
                  name={nama}
                  photoEntity="uker"
                  entityId={ukerId}
                />
              </Field>
              <Field label="Profile" align="start">
                <span className="block min-h-24 whitespace-pre-line">
                  {profil || "Belum ada deskripsi profil untuk unit kerja ini."}
                </span>
              </Field>
            </dl>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Foto {nama}</h3>
              <div className="rounded-2xl border border-border/60 p-3">
                <PhotoGallery entity="uker" entityId={ukerId} title="" />
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Data Pekerja</h3>
              <div className="rounded-2xl border border-border/60 p-4">
                {workers.isLoading ? (
                  <p className="text-sm text-muted-foreground">Memuat data pekerja…</p>
                ) : list.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada pekerja terdaftar.</p>
                ) : (
                  <div className="grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
                    {columnsWorkers.map((col, ci) => (
                      <ol key={ci} className="space-y-1.5">
                        {col.map((w, i) => (
                          <li key={w.id} className="flex gap-2 text-sm">
                            <span className="w-6 shrink-0 tabular-nums text-muted-foreground">
                              {(ci === 0 ? 0 : half) + i + 1}.
                            </span>
                            <span className="flex-1">
                              <span className="font-medium">
                                <EmployeeProfileLink employeeId={w.id} nama={w.nama} />
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {w.jabatan}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ol>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <p className="text-right text-xs text-muted-foreground">Data Update {updated}</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({
  label,
  children,
  align = "center",
}: {
  label: string;
  children: React.ReactNode;
  align?: "center" | "start";
}) {
  return (
    <div className={`flex gap-3 ${align === "start" ? "items-start" : "items-center"}`}>
      <dt className="w-24 shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="flex-1 rounded-full border border-border/60 px-4 py-2 text-sm data-[block=true]:rounded-2xl" data-block={align === "start"}>
        {children}
      </dd>
    </div>
  );
}

