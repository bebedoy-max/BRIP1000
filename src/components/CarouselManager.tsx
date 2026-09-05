import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  carouselSources,
  loadCarouselCandidates,
  loadCarouselConfig,
  type CarouselSourceKey,
} from "@/lib/carousel";

const db = supabase as unknown as SupabaseClient;

/** Pengaturan konten carousel: pilih bagian, lalu ceklis konten yang tampil. */
export function CarouselManager({ canWrite }: { canWrite: boolean }) {
  const qc = useQueryClient();
  const [sumber, setSumber] = useState<CarouselSourceKey>(carouselSources[0].value);
  const [aktif, setAktif] = useState(true);
  const [picked, setPicked] = useState<string[]>([]);

  const config = useQuery({ queryKey: ["carousel-config"], queryFn: loadCarouselConfig });
  const candidates = useQuery({
    queryKey: ["carousel-candidates", sumber],
    queryFn: () => loadCarouselCandidates(sumber, 10),
  });

  const current = useMemo(
    () => config.data?.find((c) => c.sumber === sumber),
    [config.data, sumber],
  );

  useEffect(() => {
    setAktif(current?.aktif ?? true);
    setPicked(current?.item_ids ?? []);
  }, [current]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await db.from("carousel_sources").upsert(
        {
          sumber,
          aktif,
          item_ids: picked,
          jumlah: picked.length || 10,
          urutan: carouselSources.findIndex((s) => s.value === sumber) + 1,
        },
        { onConflict: "sumber" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pengaturan carousel disimpan");
      void qc.invalidateQueries({ queryKey: ["carousel-config"] });
      void qc.invalidateQueries({ queryKey: ["home-carousel"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const items = candidates.data ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Konten Carousel</h1>
        <p className="text-sm text-muted-foreground">
          Pilih bagian konten, lalu ceklis konten mana saja dari 10 data terakhir yang tampil di
          carousel dashboard umum. Urutan slide selalu diacak. Bila tidak ada yang diceklis, sistem
          memakai 10 konten terakhir.
        </p>
      </div>

      <div className="glass-card space-y-4 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="grid gap-2">
            <Label htmlFor="bagian">Bagian Konten</Label>
            <select
              id="bagian"
              className="h-10 rounded-xl border border-input bg-popover px-3 text-sm"
              value={sumber}
              onChange={(e) => setSumber(e.target.value as CarouselSourceKey)}
            >
              {carouselSources.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="aktif"
              checked={aktif}
              onCheckedChange={setAktif}
              disabled={!canWrite}
            />
            <Label htmlFor="aktif">Tampilkan bagian ini</Label>
          </div>
        </div>

        <div className="rounded-xl border border-border/60">
          {candidates.isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Memuat konten…</p>
          ) : items.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Belum ada konten pada bagian ini.</p>
          ) : (
            items.map((i) => (
              <label
                key={i.id}
                className="flex cursor-pointer items-center gap-3 border-b border-border/40 px-3 py-2.5 text-sm last:border-0 hover:bg-secondary/40"
              >
                <Checkbox
                  checked={picked.includes(i.id)}
                  disabled={!canWrite}
                  onCheckedChange={(v) =>
                    setPicked((p) => (v ? [...p, i.id] : p.filter((x) => x !== i.id)))
                  }
                />
                <span className="min-w-0 flex-1 truncate font-medium">{i.label}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{i.sub}</span>
              </label>
            ))
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {picked.length ? `${picked.length} konten dipilih` : "Default: 10 konten terakhir"}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setPicked([])} disabled={!canWrite}>
              Kosongkan
            </Button>
            <Button
              variant="secondary"
              onClick={() => setPicked(items.map((i) => i.id))}
              disabled={!canWrite}
            >
              Pilih Semua
            </Button>
            <Button onClick={() => save.mutate()} disabled={!canWrite || save.isPending}>
              Simpan
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
