import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Cloud, Link2, Plus, RefreshCw, Trash2, Unplug } from "lucide-react";
import { AdminPage } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  listDriveAccounts,
  saveDriveAccount,
  deleteDriveAccount,
  activateDriveAccount,
  driveAuthUrl,
  type DriveAccountView,
} from "@/lib/drive.functions";
import { photoEntities, photoEntityKeys } from "@/lib/drive-entities";

export const Route = createFileRoute("/_authenticated/admin/drive")({
  head: () => ({
    meta: [
      { title: "Google Drive — Panel BRI BO Pringsewu" },
      { name: "description", content: "Pengaturan Google Drive sebagai cloud storage aplikasi." },
      { property: "og:title", content: "Google Drive — Panel BRI BO Pringsewu" },
      {
        property: "og:description",
        content: "Kelola akun Google Drive yang dipakai aplikasi untuk menyimpan foto dan file.",
      },
    ],
  }),
  component: Page,
});

type FormState = {
  id?: string;
  label: string;
  client_id: string;
  client_secret: string;
  root_folder_name: string;
};

const empty: FormState = {
  label: "",
  client_id: "",
  client_secret: "",
  root_folder_name: "SUPER IT DATA",
};

function Page() {
  const qc = useQueryClient();
  const list = useServerFn(listDriveAccounts);
  const save = useServerFn(saveDriveAccount);
  const remove = useServerFn(deleteDriveAccount);
  const activate = useServerFn(activateDriveAccount);
  const authUrl = useServerFn(driveAuthUrl);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty);

  const accounts = useQuery({
    queryKey: ["drive_accounts"],
    queryFn: () => list(),
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["drive_accounts"] });

  const saving = useMutation({
    mutationFn: (f: FormState) =>
      save({
        data: {
          ...(f.id ? { id: f.id } : {}),
          label: f.label,
          client_id: f.client_id,
          client_secret: f.client_secret,
          root_folder_name: f.root_folder_name,
        },
      }),
    onSuccess: () => {
      toast.success("Konfigurasi tersimpan");
      setOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removing = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Akun Drive dihapus");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activating = useMutation({
    mutationFn: (id: string) => activate({ data: { id } }),
    onSuccess: () => {
      toast.success("Akun Drive aktif diperbarui");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function connect(acc: DriveAccountView) {
    try {
      const { url } = await authUrl({ data: { id: acc.id, origin: window.location.origin } });
      window.open(url, "_blank", "width=520,height=680");
      toast.info("Selesaikan login Google, lalu klik Segarkan.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const redirectUri =
    typeof window !== "undefined" ? `${window.location.origin}/api/public/google-drive/callback` : "";

  return (
    <AdminPage menuKey="drive">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Google Drive</h1>
            <p className="text-sm text-muted-foreground">
              Cloud storage aplikasi. Semua foto dan file tersimpan di akun Google Drive yang aktif.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => accounts.refetch()}>
              <RefreshCw className="size-4" /> Segarkan
            </Button>
            <Button
              onClick={() => {
                setForm(empty);
                setOpen(true);
              }}
            >
              <Plus className="size-4" /> Tambah Akun Drive
            </Button>
          </div>
        </div>

        <div className="glass-card space-y-3 p-4 text-sm">
          <p className="font-medium">Cara setup</p>
          <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>Buka Google Cloud Console → APIs &amp; Services → Credentials.</li>
            <li>
              Buat <b>OAuth client ID</b> tipe <b>Web application</b>, lalu aktifkan <b>Google Drive API</b>.
            </li>
            <li>
              Tambahkan Authorized redirect URI:{" "}
              <code className="rounded bg-secondary px-1 py-0.5">{redirectUri}</code>
            </li>
            <li>Tempel Client ID &amp; Secret di sini, simpan, lalu klik “Hubungkan”.</li>
          </ol>
          <p className="text-muted-foreground">
            Struktur folder otomatis: <b>Nama folder root</b> →{" "}
            {photoEntityKeys.map((k) => photoEntities[k].folder).join(", ")}.
          </p>
        </div>

        <div className="grid gap-3">
          {accounts.isLoading ? (
            <p className="text-sm text-muted-foreground">Memuat…</p>
          ) : (accounts.data ?? []).length === 0 ? (
            <div className="glass-card p-8 text-center text-sm text-muted-foreground">
              Belum ada akun Google Drive. Klik “Tambah Akun Drive”.
            </div>
          ) : (
            (accounts.data ?? []).map((a) => (
              <div key={a.id} className="glass-card space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Cloud className="size-4 text-muted-foreground" />
                  <span className="font-medium">{a.label}</span>
                  {a.is_active ? <Badge>Aktif</Badge> : null}
                  <Badge variant={a.connected ? "secondary" : "outline"}>
                    {a.connected ? `Terhubung — ${a.account_email ?? "akun Google"}` : "Belum terhubung"}
                  </Badge>
                </div>
                <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                  <p className="truncate">Client ID: {a.client_id}</p>
                  <p className="truncate">Folder root: {a.root_folder_name}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => connect(a)}>
                    <Link2 className="size-4" /> {a.connected ? "Hubungkan ulang" : "Hubungkan"}
                  </Button>
                  {!a.is_active ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => activating.mutate(a.id)}
                      disabled={!a.connected}
                    >
                      <Unplug className="size-4" /> Jadikan aktif
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setForm({
                        id: a.id,
                        label: a.label,
                        client_id: a.client_id,
                        client_secret: "",
                        root_folder_name: a.root_folder_name,
                      });
                      setOpen(true);
                    }}
                  >
                    Ubah
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => removing.mutate(a.id)}
                  >
                    <Trash2 className="size-4" /> Hapus
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Ubah Akun Drive" : "Tambah Akun Drive"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="label">Nama Akun</Label>
              <Input
                id="label"
                value={form.label}
                placeholder="contoh: Drive IT Pringsewu"
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cid">Google OAuth Client ID</Label>
              <Input
                id="cid"
                value={form.client_id}
                onChange={(e) => setForm({ ...form, client_id: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="csec">
                Google OAuth Client Secret {form.id ? "(kosongkan bila tidak diganti)" : ""}
              </Label>
              <Input
                id="csec"
                type="password"
                value={form.client_secret}
                onChange={(e) => setForm({ ...form, client_secret: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="root">Nama folder root di Drive</Label>
              <Input
                id="root"
                value={form.root_folder_name}
                onChange={(e) => setForm({ ...form, root_folder_name: e.target.value })}
              />
            </div>
            <p className="text-xs text-muted-foreground">Authorized redirect URI: {redirectUri}</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button onClick={() => saving.mutate(form)} disabled={saving.isPending}>
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}
