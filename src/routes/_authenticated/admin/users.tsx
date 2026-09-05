import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, Lock, LockOpen, Mail, Trash2 } from "lucide-react";
import { AdminPage } from "@/components/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useRoles } from "@/lib/roles";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  deleteUser,
  isOnline,
  sendPasswordReset,
  setBlocked,
  setPassword,
  useAdminUsers,
  type AdminUser,
} from "@/lib/users";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({
    meta: [
      { title: "Daftar User — Panel BRI BO Pringsewu" },
      {
        name: "description",
        content: "Kelola pengguna aplikasi: status online, blokir, reset dan ubah kata sandi.",
      },
      { property: "og:title", content: "Daftar User — Panel BRI BO Pringsewu" },
      { property: "og:description", content: "Manajemen pengguna dan status aktivitas realtime." },
    ],
  }),
  component: () => (
    <AdminPage menuKey="users">
      <Page />
    </AdminPage>
  ),
});

const fmt = (v: string | null) => (v ? new Date(v).toLocaleString("id-ID") : "—");

function relative(v: string | null) {
  if (!v) return "Belum pernah";
  const diff = Date.now() - new Date(v).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Baru saja";
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.floor(h / 24)} hari lalu`;
}

function Page() {
  const qc = useQueryClient();
  const confirmDialog = useConfirm();
  const { isSuperadmin, session } = useRoles();
  const users = useAdminUsers();
  const [q, setQ] = useState("");
  const [pwTarget, setPwTarget] = useState<AdminUser | null>(null);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const rows = useMemo(() => {
    const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    return (users.data ?? []).filter((u) => {
      const hay = [
        u.nama,
        u.email,
        u.username,
        u.last_activity,
        ...u.roles,
        isOnline(u) ? "online" : "offline",
        u.is_blocked ? "diblokir blocked" : "aktif active",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [users.data, q]);

  async function run(key: string, fn: () => Promise<void>, ok: string) {
    setBusy(key);
    try {
      await fn();
      toast.success(ok);
      await qc.invalidateQueries({ queryKey: ["admin_users"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memproses");
    } finally {
      setBusy(null);
    }
  }

  const onlineCount = rows.filter(isOnline).length;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Daftar User</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length} pengguna · {onlineCount} sedang online
          </p>
        </div>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama, email, peran, status…"
          className="w-full max-w-sm"
        />
      </div>

      <div className="glass-card mt-6 overflow-x-auto p-2">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Pengguna</th>
              <th className="p-3">Peran</th>
              <th className="p-3">Status</th>
              <th className="p-3">Last Online</th>
              <th className="p-3">Last Activity</th>
              <th className="p-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {users.isLoading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  Memuat…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  Tidak ada pengguna.
                </td>
              </tr>
            ) : (
              rows.map((u) => {
                const online = isOnline(u);
                const self = u.id === session?.user.id;
                return (
                  <tr key={u.id} className="border-t border-border/50 align-top">
                    <td className="p-3">
                      <div className="font-medium">{u.nama || u.username || "(tanpa nama)"}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          u.roles.map((r) => (
                            <Badge key={r} variant="secondary" className="text-[10px]">
                              {r}
                            </Badge>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`size-2 rounded-full ${online ? "bg-emerald-500" : "bg-muted-foreground/50"}`}
                        />
                        <span className="text-xs">{online ? "Online" : "Offline"}</span>
                      </div>
                      {u.is_blocked && (
                        <Badge variant="destructive" className="mt-1 text-[10px]">
                          Diblokir
                        </Badge>
                      )}
                    </td>
                    <td className="p-3">
                      <div>{relative(u.last_online)}</div>
                      <div className="text-xs text-muted-foreground">{fmt(u.last_online)}</div>
                    </td>
                    <td className="p-3">
                      <div>{u.last_activity || "—"}</div>
                      <div className="text-xs text-muted-foreground">{fmt(u.last_activity_at)}</div>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy !== null || self}
                          onClick={() =>
                            void run(
                              u.id,
                              () => setBlocked(u.id, !u.is_blocked),
                              u.is_blocked ? "Pengguna dibuka blokirnya" : "Pengguna diblokir",
                            )
                          }
                        >
                          {u.is_blocked ? (
                            <>
                              <LockOpen className="size-4" /> Unblock
                            </>
                          ) : (
                            <>
                              <Lock className="size-4" /> Block
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy !== null || !u.email}
                          onClick={() =>
                            void run(
                              u.id,
                              () => sendPasswordReset(u.email!),
                              "Tautan reset kata sandi dikirim",
                            )
                          }
                        >
                          <Mail className="size-4" /> Reset
                        </Button>
                        {isSuperadmin && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy !== null}
                              onClick={() => {
                                setPw("");
                                setPwTarget(u);
                              }}
                            >
                              <KeyRound className="size-4" /> Ubah Sandi
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              disabled={busy !== null || self}
                              onClick={() => {
                                void confirmDialog({
                                  title: "Hapus pengguna ini?",
                                  description: `${u.email} akan dihapus permanen dari sistem.`,
                                  confirmText: "Hapus",
                                  destructive: true,
                                }).then((ok) => {
                                  if (ok) void run(u.id, () => deleteUser(u.id), "Pengguna dihapus");
                                });
                              }}
                            >
                              <Trash2 className="size-4" /> Hapus
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={pwTarget !== null} onOpenChange={(o) => !o && setPwTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ubah Kata Sandi</DialogTitle>
            <DialogDescription>{pwTarget?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="newpw">Kata sandi baru</Label>
            <Input
              id="newpw"
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="Minimal 8 karakter"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPwTarget(null)}>
              Batal
            </Button>
            <Button
              disabled={pw.length < 8 || busy !== null}
              onClick={() => {
                const target = pwTarget;
                if (!target) return;
                void run(target.id, () => setPassword(target.id, pw), "Kata sandi diperbarui").then(
                  () => setPwTarget(null),
                );
              }}
            >
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
