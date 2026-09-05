import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MapPin } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { PhotoGallery } from "@/components/PhotoGallery";

const db = supabase as unknown as SupabaseClient;

type Detail = {
  tid: string;
  lokasi: string;
  titik_maps: string;
  merk: string;
  ip_address: string;
  updated: string;
};

/** Label lokasi ATM/CRM yang bisa diklik: membuka pop up detail mesin. */
export function MachineProfileLink({
  machineId,
  lokasi,
  jenis = "ATM",
}: {
  machineId: string;
  lokasi: string;
  /** "ATM" atau "CRM" — menentukan tabel & galeri foto yang dibaca. */
  jenis?: string;
}) {
  const [open, setOpen] = useState(false);
  const isCrm = String(jenis).toUpperCase() === "CRM";
  const table = isCrm ? "crm_machines" : "atm_machines";
  const entity = isCrm ? "crm" : "atm";

  const detail = useQuery<Detail | null>({
    queryKey: ["machine-profile", table, machineId],
    enabled: open && !!machineId,
    queryFn: async () => {
      const { data, error } = await db.from(table).select("*").eq("id", machineId).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = data as Record<string, unknown>;
      const updatedRaw = String(row["updated_at"] ?? row["created_at"] ?? "");
      return {
        tid: String(row["tid"] ?? ""),
        lokasi: String(row["lokasi"] ?? ""),
        titik_maps: String(row["titik_maps"] ?? ""),
        merk: String(row["merk"] ?? ""),
        ip_address: String(row["ip_address"] ?? ""),
        updated: updatedRaw
          ? new Date(updatedRaw).toLocaleDateString("id-ID", { dateStyle: "medium" })
          : "—",
      };
    },
  });

  const d = detail.data;
  const judul = `${isCrm ? "CRM" : "ATM"} ${lokasi}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-left text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label={`Lihat detail ${judul}`}
      >
        <MapPin className="size-3.5 shrink-0" />
        <span>{lokasi}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-extrabold tracking-tight">{judul}</DialogTitle>
            <DialogDescription className="sr-only">Detail mesin ATM/CRM</DialogDescription>
          </DialogHeader>

          {detail.isLoading ? (
            <p className="text-sm text-muted-foreground">Memuat detail mesin…</p>
          ) : (
            <div className="space-y-4">
              <dl className="space-y-2">
                <Field label="TID">{d?.tid || "—"}</Field>
                <Field label="Alamat">{d?.lokasi || "—"}</Field>
                <Field label="Titik Maps">{d?.titik_maps || "—"}</Field>
                <Field label="Merk">{d?.merk || "—"}</Field>
                <Field label="IP Address">{d?.ip_address || "—"}</Field>
              </dl>

              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Foto {judul}</h3>
                <div className="rounded-2xl border border-border/60 p-3">
                  <PhotoGallery entity={entity} entityId={machineId} title="" />
                </div>
              </section>

              <p className="text-right text-xs text-muted-foreground">
                Data Update {d?.updated ?? "—"}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <dt className="w-32 shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="flex-1 rounded-full border border-border/60 px-4 py-2 text-sm">{children}</dd>
    </div>
  );
}
