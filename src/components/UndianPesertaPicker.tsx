import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { listUndianEmployeeOptions } from "@/lib/undian.functions";

export type PickedEmployee = { nip: string; nama: string; unitKerja: string; jabatan: string };

/** Dialog pilih peserta undian dari Data Pekerja: ceklis nama, filter jabatan & unit kerja. */
export function UndianPesertaPicker(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** NIP yang sudah menjadi peserta (dinonaktifkan di daftar). */
  existingNips: string[];
  onImport: (rows: PickedEmployee[]) => Promise<void>;
}) {
  const { open, onOpenChange, existingNips, onImport } = props;
  const q = useQuery({
    queryKey: ["undian-employee-options"],
    queryFn: () => listUndianEmployeeOptions(),
    enabled: open,
  });

  const employees = useMemo(() => (q.data ?? []) as PickedEmployee[], [q.data]);
  const already = useMemo(() => new Set(existingNips), [existingNips]);

  const [cari, setCari] = useState("");
  const [jabatan, setJabatan] = useState("all");
  const [unitKerja, setUnitKerja] = useState("all");
  const [sortBy, setSortBy] = useState<"nama" | "jabatan" | "unitKerja">("nama");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const jabatanOptions = useMemo(
    () => [...new Set(employees.map((e) => e.jabatan))].sort((a, b) => a.localeCompare(b)),
    [employees],
  );
  const unitOptions = useMemo(
    () => [...new Set(employees.map((e) => e.unitKerja))].sort((a, b) => a.localeCompare(b)),
    [employees],
  );

  const filtered = useMemo(() => {
    const q = cari.toLowerCase();
    return employees
      .filter(
        (e) =>
          (!q || e.nama.toLowerCase().includes(q) || e.nip.includes(q)) &&
          (jabatan === "all" || e.jabatan === jabatan) &&
          (unitKerja === "all" || e.unitKerja === unitKerja),
      )
      .sort((a, b) =>
        sortBy === "nama"
          ? a.nama.localeCompare(b.nama)
          : sortBy === "jabatan"
            ? a.jabatan.localeCompare(b.jabatan) || a.nama.localeCompare(b.nama)
            : a.unitKerja.localeCompare(b.unitKerja) || a.nama.localeCompare(b.nama),
      );
  }, [employees, cari, jabatan, unitKerja, sortBy]);

  const selectable = filtered.filter((e) => !already.has(e.nip));
  const allChecked = selectable.length > 0 && selectable.every((e) => selected.has(e.nip));
  const selectedRows = employees.filter((e) => selected.has(e.nip) && !already.has(e.nip));

  function toggle(nip: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(nip)) next.delete(nip);
      else next.add(nip);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) for (const e of selectable) next.delete(e.nip);
      else for (const e of selectable) next.add(e.nip);
      return next;
    });
  }

  async function submit() {
    if (selectedRows.length === 0 || saving) return;
    setSaving(true);
    try {
      await onImport(selectedRows);
      setSelected(new Set());
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  const selectClass =
    "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="size-5" /> Pilih Peserta dari Data Pekerja
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari nama / personal number…"
              className="pl-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Filter Jabatan</Label>
            <select value={jabatan} onChange={(e) => setJabatan(e.target.value)} className={selectClass}>
              <option value="all">Semua Jabatan</option>
              {jabatanOptions.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Filter Unit Kerja</Label>
            <select value={unitKerja} onChange={(e) => setUnitKerja(e.target.value)} className={selectClass}>
              <option value="all">Semua Unit Kerja</option>
              {unitOptions.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs font-semibold">Urutkan</Label>
            <div className="flex gap-2">
              {(
                [
                  ["nama", "Nama"],
                  ["jabatan", "Jabatan"],
                  ["unitKerja", "Unit Kerja"],
                ] as const
              ).map(([key, label]) => (
                <Button
                  key={key}
                  size="sm"
                  variant={sortBy === key ? "default" : "secondary"}
                  onClick={() => setSortBy(key)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border/60">
          <label className="flex cursor-pointer items-center gap-2 border-b border-border/60 bg-muted/60 px-3 py-2 text-sm font-semibold">
            <input type="checkbox" checked={allChecked} onChange={toggleAll} className="size-4" />
            Pilih semua hasil filter ({selectable.length})
          </label>
          <div className="max-h-72 overflow-auto">
            {q.isLoading ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">Memuat pekerja…</p>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Tidak ada pekerja yang cocok.
              </p>
            ) : (
              filtered.map((e) => {
                const disabled = already.has(e.nip);
                return (
                  <label
                    key={e.nip}
                    className={`flex items-center gap-3 border-b border-border/40 px-3 py-2 text-sm last:border-0 ${
                      disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer hover:bg-muted/40"
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={disabled}
                      checked={selected.has(e.nip)}
                      onChange={() => toggle(e.nip)}
                      className="size-4 shrink-0"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{e.nama}</span>
                      <span className="block text-xs text-muted-foreground">
                        {e.nip} · {e.unitKerja} · {e.jabatan}
                        {disabled ? " · sudah jadi peserta" : ""}
                      </span>
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {selectedRows.length} pekerja dipilih
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button onClick={() => void submit()} disabled={selectedRows.length === 0 || saving}>
              {saving ? "Mengimpor…" : `Impor ${selectedRows.length} Peserta`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
