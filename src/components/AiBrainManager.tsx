import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Brain, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  deleteAiBrain,
  listAiBrains,
  saveAiBrain,
  testAiBrain,
} from "@/lib/ai-brain.functions";
import { aiProviders, type AiBrainView, type AiProvider } from "@/lib/ai-brain.types";

type FormState = {
  id?: string;
  nama: string;
  provider: AiProvider;
  model: string;
  base_url: string;
  api_key: string;
  aktif: boolean;
  is_default: boolean;
};

const emptyForm: FormState = {
  nama: "",
  provider: "gemini",
  model: "gemini-2.5-flash",
  base_url: "",
  api_key: "",
  aktif: true,
  is_default: false,
};

export function AiBrainManager() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const list = useServerFn(listAiBrains);
  const save = useServerFn(saveAiBrain);
  const remove = useServerFn(deleteAiBrain);
  const test = useServerFn(testAiBrain);

  const { data, isLoading, error } = useQuery({
    queryKey: ["ai_brains"],
    queryFn: () => list(),
  });
  const brains: AiBrainView[] = (data?.brains ?? []) as AiBrainView[];

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const saving = useMutation({
    mutationFn: () =>
      save({
        data: {
          ...(form.id ? { id: form.id } : {}),
          nama: form.nama,
          provider: form.provider,
          model: form.model,
          base_url: form.base_url || null,
          api_key: form.api_key || null,
          aktif: form.aktif,
          is_default: form.is_default,
        },
      }),
    onSuccess: () => {
      toast.success("AI Brain disimpan");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["ai_brains"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testing = useMutation({
    mutationFn: (id: string) => test({ data: { id } }),
    onSuccess: (r) => toast.success(r.text || "Koneksi berhasil"),
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew() {
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(b: AiBrainView) {
    setForm({
      id: b.id,
      nama: b.nama,
      provider: b.provider,
      model: b.model,
      base_url: b.base_url ?? "",
      api_key: "",
      aktif: b.aktif,
      is_default: b.is_default,
    });
    setOpen(true);
  }

  async function del(b: AiBrainView) {
    const ok = await confirm({
      title: "Hapus AI Brain?",
      description: `Koneksi "${b.nama}" akan dihapus.`,
    });
    if (!ok) return;
    try {
      await remove({ data: { id: b.id } });
      toast.success("AI Brain dihapus");
      qc.invalidateQueries({ queryKey: ["ai_brains"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="glass-card flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Brain className="size-5" /> AI Brain
          </h1>
          <p className="text-sm text-muted-foreground">
            Simpan koneksi AI (Gemini, OpenAI, Claude, atau layanan kompatibel OpenAI) yang dipakai
            aplikasi sebagai “otak” untuk fitur cerdas — mulai dari menulis isi menu Tutorial.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="size-4" /> Tambah AI Brain
        </Button>
      </div>

      {error ? (
        <div className="glass-card p-6 text-sm text-muted-foreground">
          {(error as Error).message}
        </div>
      ) : isLoading ? null : !brains.length ? (
        <div className="glass-card flex flex-col items-center gap-2 p-12 text-center">
          <Sparkles className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Belum ada koneksi AI. Tambahkan API key untuk mengaktifkan fitur AI.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {brains.map((b) => (
            <div key={b.id} className="glass-card space-y-2 p-4">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{b.nama}</p>
                  <p className="text-xs text-muted-foreground">
                    {aiProviders.find((p) => p.value === b.provider)?.label ?? b.provider} ·{" "}
                    {b.model}
                  </p>
                </div>
                {b.is_default ? <Badge>Default</Badge> : null}
                <Badge variant={b.aktif ? "secondary" : "outline"}>
                  {b.aktif ? "Aktif" : "Nonaktif"}
                </Badge>
              </div>
              <p className="font-mono text-xs text-muted-foreground">{b.key_preview}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={testing.isPending}
                  onClick={() => testing.mutate(b.id)}
                >
                  <Sparkles className="size-4" /> Tes koneksi
                </Button>
                <Button size="sm" variant="ghost" onClick={() => openEdit(b)}>
                  <Pencil className="size-4" /> Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => del(b)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit AI Brain" : "Tambah AI Brain"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nama</Label>
              <Input
                value={form.nama}
                onChange={(e) => setForm((s) => ({ ...s, nama: e.target.value }))}
                placeholder="Gemini Utama"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Provider</Label>
                <Select
                  value={form.provider}
                  onValueChange={(v) => {
                    const p = aiProviders.find((x) => x.value === v);
                    setForm((s) => ({
                      ...s,
                      provider: v as AiProvider,
                      model: p?.model || s.model,
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {aiProviders.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Model</Label>
                <Input
                  value={form.model}
                  onChange={(e) => setForm((s) => ({ ...s, model: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>API Key</Label>
              <Input
                type="password"
                value={form.api_key}
                onChange={(e) => setForm((s) => ({ ...s, api_key: e.target.value }))}
                placeholder={form.id ? "Kosongkan bila tidak diubah" : "Tempel API key di sini"}
              />
            </div>
            <div className="space-y-1">
              <Label>Base URL (opsional)</Label>
              <Input
                value={form.base_url}
                onChange={(e) => setForm((s) => ({ ...s, base_url: e.target.value }))}
                placeholder="https://api.contoh.com/v1"
              />
            </div>
            <div className="flex items-center gap-6 pt-1">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={form.aktif}
                  onCheckedChange={(v) => setForm((s) => ({ ...s, aktif: v }))}
                />
                Aktif
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={form.is_default}
                  onCheckedChange={(v) => setForm((s) => ({ ...s, is_default: v }))}
                />
                Jadikan default
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button onClick={() => saving.mutate()} disabled={saving.isPending}>
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
