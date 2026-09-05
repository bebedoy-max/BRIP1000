import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Copy,
  Crop,
  Download,
  ImagePlus,
  Lock,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  Trophy,
  Unlock,
  UserRound,
  Vote,

} from "lucide-react";
import { toast } from "sonner";
import { AdminPage } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useConfirm } from "@/components/ConfirmDialog";
import { PhotoCropDialog } from "@/components/PhotoCropDialog";
import { DatePickerField } from "@/components/DatePickerField";
import { compressImage, formatDateID, pickImage } from "@/lib/absensi-ui";
import {
  printVoteReport,
  rankNominees,
  votePalette,
  voteIcons,
  type VoteCategory,
  type VoteNominee,
  type VoteSettings,
} from "@/lib/vote-ui";
type VoteEmployee = {
  id: string;
  nama: string;
  personalNumber: string | null;
  jabatan: string | null;
  uker: string | null;
  foto?: string | null;
};


import {
  addVoteAdmin,
  deleteVoteNominee,
  getVoteAdminEvent,
  fetchVoteImage,
  listVoteEmployees,
  listVoteWorkerPhotos,
  removeVoteAdmin,
  resetVoteBallots,
  saveVoteEvent,
  saveVoteNominee,
  setVoteClosed,
  setVoteHold,
} from "@/lib/vote.functions";

export const Route = createFileRoute("/_authenticated/admin/tools/vote/$id")({
  head: () => ({
    meta: [
      { title: "Kelola Vote — SuperIT Apps" },
      {
        name: "description",
        content: "Atur nominasi, admin, status voting, dan rekap suara untuk satu vote event.",
      },
      { property: "og:title", content: "Kelola Vote — SuperIT Apps" },
      { property: "og:description", content: "Pengaturan vote event BRI BO Pringsewu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

const emptyNominee = {
  id: undefined as string | undefined,
  category: "",
  nama: "",
  jabatan: "",
  uker: "",
  personalNumber: "",
  foto: "" as string,
};

function Page() {
  const { id } = Route.useParams();
  const confirm = useConfirm();
  const [tab, setTab] = useState("pengaturan");
  const [draft, setDraft] = useState<VoteSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [nomOpen, setNomOpen] = useState(false);
  const [nom, setNom] = useState(emptyNominee);
  const [adminEmail, setAdminEmail] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["vote-event", id],
    queryFn: () => getVoteAdminEvent({ data: { id } }),
  });
  const employees = useQuery({
    queryKey: ["vote-employees"],
    queryFn: () => listVoteEmployees(),
    staleTime: 300_000,
  });
  /** Foto master wajah pekerja yang cocok dengan nominasi yang sedang diedit. */
  const employeePhoto = useMemo(() => {
    const list = (employees.data ?? []) as VoteEmployee[];
    const pn = (nom.personalNumber || "").trim();
    const name = (nom.nama || "").trim().toLowerCase();
    const emp =
      (pn ? list.find((e) => (e.personalNumber ?? "").trim() === pn) : undefined) ??
      (name ? list.find((e) => e.nama.trim().toLowerCase() === name) : undefined);
    return emp?.foto ?? "";
  }, [employees.data, nom.personalNumber, nom.nama]);


  /** Pekerja yang cocok dengan nominasi yang sedang diedit. */
  const matchedEmployee = useMemo(() => {
    const list = (employees.data ?? []) as VoteEmployee[];
    const pn = (nom.personalNumber || "").trim();
    const name = (nom.nama || "").trim().toLowerCase();
    return (
      (pn ? list.find((e) => (e.personalNumber ?? "").trim() === pn) : undefined) ??
      (name ? list.find((e) => e.nama.trim().toLowerCase() === name) : undefined) ??
      null
    );
  }, [employees.data, nom.personalNumber, nom.nama]);

  const photos = useQuery({
    queryKey: ["vote-worker-photos", matchedEmployee?.id ?? "", nom.personalNumber],
    enabled: pickerOpen,
    queryFn: () =>
      listVoteWorkerPhotos({
        data: {
          workerId: matchedEmployee?.id,
          personalNumber: (nom.personalNumber || "").trim() || undefined,
        },
      }),
  });

  /** Ambil foto pilihan (via server agar bebas CORS) lalu buka dialog crop. */
  const usePhoto = async (url: string) => {
    try {
      const src = url.startsWith("data:")
        ? url
        : (await fetchVoteImage({ data: { url } })).dataUrl;
      setPickerOpen(false);
      setCropSrc(src);
    } catch {
      toast.error("Foto gagal dimuat.");
    }
  };

  const event = (draft ?? q.data?.event ?? null) as VoteSettings | null;
  const saved = q.data?.event as VoteSettings | undefined;
  const nominees = (q.data?.nominees ?? []) as VoteNominee[];
  const results = q.data?.results ?? [];
  const stats = q.data?.stats ?? { totalVoters: 0, votedCount: 0, notVotedCount: 0 };

  const totalSuara = useMemo(
    () => results.reduce((a, r) => a + Number(r.total || 0), 0),
    [results],
  );

  function patch(p: Partial<VoteSettings>) {
    if (!event) return;
    setDraft({ ...event, ...p });
  }

  async function save() {
    if (!event) return;
    setSaving(true);
    try {
      const { id: _drop, ...rest } = event;
      await saveVoteEvent({ data: { ...rest, id: event.id } });
      toast.success("Pengaturan tersimpan");
      setDraft(null);
      void q.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan");
    }
    setSaving(false);
  }

  async function toggleHold() {
    if (!saved) return;
    const next = !saved.isHold;
    const ok = await confirm({
      title: next ? "Aktifkan Hold?" : "Matikan Hold?",
      description: next
        ? "Peserta tidak dapat mengirim suara sampai hold dimatikan."
        : "Voting akan kembali dapat diisi peserta.",
    });
    if (!ok) return;
    await setVoteHold({ data: { eventId: saved.id, hold: next } });
    setDraft(null);
    void q.refetch();
  }

  async function toggleClosed() {
    if (!saved) return;
    const next = !saved.isClosed;
    const ok = await confirm({
      title: next ? "Tutup voting?" : "Buka kembali voting?",
      description: next
        ? "Halaman voting akan menampilkan informasi bahwa voting telah ditutup/selesai."
        : "Peserta dapat kembali memberikan suara.",
      destructive: next,
    });
    if (!ok) return;
    await setVoteClosed({ data: { eventId: saved.id, closed: next } });
    setDraft(null);
    void q.refetch();
  }

  async function resetAll() {
    if (!saved) return;
    const ok = await confirm({
      title: "Reset seluruh data vote?",
      description: "Semua suara yang masuk akan dihapus dan tidak dapat dikembalikan.",
      destructive: true,
    });
    if (!ok) return;
    await resetVoteBallots({ data: { eventId: saved.id } });
    toast.success("Data vote direset");
    void q.refetch();
  }

  async function saveNom() {
    if (!event) return;
    if (!nom.category || nom.nama.trim().length < 2) {
      toast.error("Kategori dan nama nominasi wajib diisi");
      return;
    }
    try {
      await saveVoteNominee({
        data: {
          ...(nom.id ? { id: nom.id } : {}),
          eventId: event.id,
          category: nom.category,
          nama: nom.nama.trim(),
          jabatan: nom.jabatan || null,
          uker: nom.uker || null,
          personalNumber: nom.personalNumber || null,
          foto: nom.foto || null,
          sortOrder: nominees.filter((n) => n.category === nom.category).length,
        },
      });
      setNomOpen(false);
      setNom(emptyNominee);
      void q.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan nominasi");
    }
  }

  async function removeNom(nId: string) {
    if (!event) return;
    const ok = await confirm({ title: "Hapus nominasi ini?", destructive: true });
    if (!ok) return;
    await deleteVoteNominee({ data: { eventId: event.id, id: nId } });
    void q.refetch();
  }

  async function addAdmin() {
    if (!event || !adminEmail.trim()) return;
    try {
      await addVoteAdmin({ data: { eventId: event.id, email: adminEmail.trim() } });
      setAdminEmail("");
      void q.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menambah admin");
    }
  }

  function copyLink() {
    if (!event) return;
    void navigator.clipboard.writeText(`${window.location.origin}/vote/${event.slug}`);
    toast.success("Link voting disalin");
  }

  function copyShowcaseLink() {
    if (!event) return;
    void navigator.clipboard.writeText(`${window.location.origin}/vote-show/${event.slug}`);
    toast.success("Link dashboard pemenang disalin");
  }

  function setCategory(index: number, p: Partial<VoteCategory>) {
    if (!event) return;
    const cats = event.categories.map((c, i) => (i === index ? { ...c, ...p } : c));
    patch({ categories: cats });
  }

  if (q.isLoading || !event) {
    return (
      <AdminPage menuKey="tools">
        <p className="text-sm text-muted-foreground">Memuat...</p>
      </AdminPage>
    );
  }

  return (
    <AdminPage menuKey="tools">
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Vote className="size-6" /> {event.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              {event.subtitle} · {formatDateID(event.eventDate)} · /vote/{event.slug}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={saved?.isClosed ? "destructive" : saved?.isHold ? "secondary" : "default"}>
              {saved?.isClosed ? "Voting Ditutup" : saved?.isHold ? "Hold Aktif" : "Voting Dibuka"}
            </Badge>
            <Button size="sm" variant="secondary" onClick={copyLink}>
              <Copy className="size-4" /> Salin link
            </Button>
            <Button size="sm" onClick={() => window.open(`/vote-show/${event.slug}`, "_blank")}>
              <Trophy className="size-4" /> Dashboard Pemenang
            </Button>
            <Button size="sm" variant="ghost" onClick={copyShowcaseLink}>
              <Copy className="size-4" /> Salin link dashboard
            </Button>
          </div>
        </div>

        {saved?.isClosed ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
            Voting telah <b>ditutup</b>. Peserta hanya melihat informasi bahwa voting sudah selesai.
          </div>
        ) : saved?.isHold ? (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
            Voting sedang di-<b>hold</b>. Peserta tidak dapat mengirim suara sampai hold dimatikan.
          </div>
        ) : null}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="pengaturan">Pengaturan</TabsTrigger>
            <TabsTrigger value="nominasi">Nominasi</TabsTrigger>
            <TabsTrigger value="laporan">Laporan</TabsTrigger>
            <TabsTrigger value="admin">Admin</TabsTrigger>
          </TabsList>

          {/* ------------------------------ pengaturan ----------------------------- */}
          <TabsContent value="pengaturan" className="space-y-4">
            <div className="glass-card grid gap-4 p-5 sm:grid-cols-2">
              <div>
                <Label>Judul</Label>
                <Input value={event.title} onChange={(e) => patch({ title: e.target.value })} />
              </div>
              <div>
                <Label>Sub Judul</Label>
                <Input
                  value={event.subtitle}
                  onChange={(e) => patch({ subtitle: e.target.value })}
                />
              </div>
              <div>
                <Label>Eyebrow</Label>
                <Input value={event.eyebrow} onChange={(e) => patch({ eyebrow: e.target.value })} />
              </div>
              <div>
                <Label>Label Dashboard Pemenang</Label>
                <Input
                  value={event.showcaseNote}
                  onChange={(e) => patch({ showcaseNote: e.target.value })}
                />
              </div>
              <div>
                <Label>Lokasi Acara</Label>
                <Input
                  value={event.location}
                  onChange={(e) => patch({ location: e.target.value })}
                  placeholder="BRI BO Pringsewu"
                />
              </div>
              <div>
                <Label>Tanggal</Label>
                <DatePickerField
                  value={event.eventDate}
                  onChange={(v) => patch({ eventDate: v })}
                />
              </div>
              <div>
                <Label>Warna Aksen</Label>
                <div className="flex flex-wrap gap-2 pt-1">
                  {votePalette.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => patch({ accent: c })}
                      style={{ background: c }}
                      className={`size-7 rounded-full border-2 ${
                        event.accent === c ? "border-foreground" : "border-transparent"
                      }`}
                      aria-label={`Warna ${c}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="glass-card space-y-3 p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Kategori Penilaian</h2>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    patch({
                      categories: [
                        ...event.categories,
                        {
                          name: `Kategori ${event.categories.length + 1}`,
                          icon: voteIcons[event.categories.length % voteIcons.length]!,
                          color: votePalette[event.categories.length % votePalette.length]!,
                        },
                      ],
                    })
                  }
                >
                  <Plus className="size-4" /> Kategori
                </Button>
              </div>
              {event.categories.map((c, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <Input
                    className="w-16 text-center"
                    value={c.icon}
                    onChange={(e) => setCategory(i, { icon: e.target.value })}
                  />
                  <Input
                    className="min-w-40 flex-1"
                    value={c.name}
                    onChange={(e) => setCategory(i, { name: e.target.value })}
                  />
                  <input
                    type="color"
                    value={c.color}
                    onChange={(e) => setCategory(i, { color: e.target.value })}
                    className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent"
                    aria-label="Warna kategori"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      patch({ categories: event.categories.filter((_, x) => x !== i) })
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={save} disabled={saving}>
                {saving ? "Menyimpan..." : "Simpan Pengaturan"}
              </Button>
              {draft ? (
                <Button variant="ghost" onClick={() => setDraft(null)}>
                  Batal
                </Button>
              ) : null}
            </div>
          </TabsContent>

          {/* ------------------------------- nominasi ------------------------------ */}
          <TabsContent value="nominasi" className="space-y-4">
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setNom({ ...emptyNominee, category: event.categories[0]?.name ?? "" });
                  setNomOpen(true);
                }}
              >
                <Plus className="size-4" /> Tambah Nominasi
              </Button>
            </div>
            {event.categories.map((c) => {
              const list = nominees.filter((n) => n.category === c.name);
              return (
                <div key={c.name} className="glass-card space-y-2 p-5">
                  <h2 className="flex items-center gap-2 font-semibold" style={{ color: c.color }}>
                    <span>{c.icon}</span> {c.name}
                    <span className="text-xs text-muted-foreground">({list.length} nominasi)</span>
                  </h2>
                  {list.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Belum ada nominasi.</p>
                  ) : (
                    <div className="divide-y divide-border/60">
                      {list.map((n) => (
                        <div key={n.id} className="flex items-center justify-between gap-3 py-2">
                          <div className="flex items-center gap-3 text-sm">
                            {n.foto ? (
                              <img
                                src={n.foto}
                                alt={n.nama}
                                className="size-9 rounded-full object-cover"
                              />
                            ) : null}
                            <div>
                            <p className="font-medium">{n.nama}</p>
                            <p className="text-xs text-muted-foreground">
                              {[n.jabatan, n.uker, n.personalNumber].filter(Boolean).join(" · ") ||
                                "-"}
                            </p>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setNom({
                                  id: n.id,
                                  category: n.category,
                                  nama: n.nama,
                                  jabatan: n.jabatan ?? "",
                                  uker: n.uker ?? "",
                                  foto: n.foto ?? "",
                                  personalNumber: n.personalNumber ?? "",
                                });
                                setNomOpen(true);
                              }}
                            >
                              Edit
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => void removeNom(n.id)}>
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </TabsContent>

          {/* -------------------------------- laporan ------------------------------ */}
          <TabsContent value="laporan" className="space-y-4">
            <div className="glass-card flex flex-wrap items-center justify-between gap-3 p-5">
              <div className="text-sm">
                <p className="font-semibold">{totalSuara} total suara</p>
                <p className="text-muted-foreground">
                  Pemilih terdaftar {stats.totalVoters} · sudah memilih {stats.votedCount} · belum{" "}
                  {stats.notVotedCount}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => void q.refetch()}>
                  <RotateCcw className="size-4" /> Muat Ulang
                </Button>
                <Button
                  size="sm"
                  onClick={() => printVoteReport(event, nominees, results, stats)}
                >
                  <Download className="size-4" /> Download PDF
                </Button>
                <Button
                  size="sm"
                  variant={saved?.isHold ? "default" : "secondary"}
                  onClick={() => void toggleHold()}
                >
                  {saved?.isHold ? <Play className="size-4" /> : <Pause className="size-4" />}
                  {saved?.isHold ? "Hold Aktif (matikan)" : "Hold"}
                </Button>
                <Button
                  size="sm"
                  variant={saved?.isClosed ? "default" : "secondary"}
                  onClick={() => void toggleClosed()}
                >
                  {saved?.isClosed ? <Unlock className="size-4" /> : <Lock className="size-4" />}
                  {saved?.isClosed ? "Buka Kembali Vote" : "Tutup Vote"}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => void resetAll()}>
                  <Trash2 className="size-4" /> Reset Data Vote
                </Button>
              </div>
            </div>

            {saved?.isClosed ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
                Voting telah ditutup — peserta tidak bisa lagi memberikan suara.
              </div>
            ) : null}

            {event.categories.map((c) => {
              const list = rankNominees(nominees, results, c.name);
              const max = Math.max(1, ...list.map((x) => x.total));
              const catTotal = list.reduce((a, x) => a + x.total, 0);
              return (
                <div key={c.name} className="glass-card space-y-3 p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold" style={{ color: c.color }}>
                      {c.icon} {c.name}
                    </h2>
                    <span className="text-xs text-muted-foreground">{catTotal} suara masuk</span>
                  </div>
                  {list.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Belum ada nominasi.</p>
                  ) : (
                    <div className="space-y-2">
                      {list.map((x, i) => (
                        <div key={x.id} className="flex items-center gap-3 text-sm">
                          <span className="w-6 text-center">
                            {i === 0 && x.total > 0 ? "🏆" : i + 1}
                          </span>
                          <span className="w-48 truncate">{x.nama}</span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${(x.total / max) * 100}%`,
                                background: c.color,
                              }}
                            />
                          </div>
                          <span className="w-20 text-right font-semibold">{x.total} suara</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </TabsContent>

          {/* --------------------------------- admin ------------------------------- */}
          <TabsContent value="admin" className="space-y-4">
            <div className="glass-card space-y-3 p-5">
              <h2 className="font-semibold">Admin Vote Event Ini</h2>
              <div className="flex flex-wrap gap-2">
                <Input
                  className="max-w-xs"
                  placeholder="email pengguna panel"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                />
                <Button onClick={() => void addAdmin()}>Tambah</Button>
              </div>
              {(q.data?.admins ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Belum ada admin khusus. Super Admin dan Admin IT tetap bisa mengelola.
                </p>
              ) : (
                <div className="divide-y divide-border/60">
                  {(q.data?.admins ?? []).map((a: { id: string; userId: string; email: string | null }) => (
                    <div key={a.id} className="flex items-center justify-between py-2 text-sm">
                      <span>{a.email ?? a.userId}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          await removeVoteAdmin({ data: { eventId: event.id, id: a.id } });
                          void q.refetch();
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={nomOpen} onOpenChange={setNomOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{nom.id ? "Edit Nominasi" : "Tambah Nominasi"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Kategori</Label>
              <Select
                value={nom.category}
                onValueChange={(v) => setNom((n) => ({ ...n, category: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {event.categories.map((c) => (
                    <SelectItem key={c.name} value={c.name}>
                      {c.icon} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Pilih dari Data Pekerja</Label>
              <Select
                value=""
                onValueChange={(v) => {
                  const emp = (employees.data ?? []).find((e: VoteEmployee) => e.id === v);
                  if (!emp) return;
                  setNom((n) => ({
                    ...n,
                    nama: emp.nama,
                    jabatan: emp.jabatan ?? "",
                    uker: emp.uker ?? "",
                    personalNumber: emp.personalNumber ?? "",
                    foto: n.foto || (emp.foto ?? ""),
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Cari pekerja..." />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {(employees.data ?? []).map((e: VoteEmployee) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nama} {e.personalNumber ? `· ${e.personalNumber}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Foto Nominasi</Label>
              <div className="flex flex-wrap items-center gap-3">
                {nom.foto ? (
                  <img
                    src={nom.foto}
                    alt="Foto nominasi"
                    className="size-16 rounded-full border border-border object-cover"
                  />
                ) : (
                  <span className="grid size-16 place-items-center rounded-full border border-dashed border-border text-xs text-muted-foreground">
                    Foto
                  </span>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    const img = await pickImage();
                    if (!img) return;
                    const small = await compressImage(img, 480, 0.85);
                    setNom((n) => ({ ...n, foto: small }));
                  }}
                >
                  <ImagePlus className="size-4" /> {nom.foto ? "Ganti Foto" : "Unggah Foto"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setPickerOpen(true)}
                >
                  <UserRound className="size-4" /> Ambil dari Data Pekerja
                </Button>
                {nom.foto ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void usePhoto(nom.foto)}
                  >
                    <Crop className="size-4" /> Crop
                  </Button>
                ) : null}
                {nom.foto ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setNom((n) => ({ ...n, foto: "" }))}
                  >
                    Hapus
                  </Button>
                ) : null}
              </div>
              {!employeePhoto && nom.personalNumber ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Pekerja ini belum punya foto master wajah di database.
                </p>
              ) : null}

            </div>

            <div>
              <Label>Nama</Label>
              <Input value={nom.nama} onChange={(e) => setNom((n) => ({ ...n, nama: e.target.value }))} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Jabatan</Label>
                <Input
                  value={nom.jabatan}
                  onChange={(e) => setNom((n) => ({ ...n, jabatan: e.target.value }))}
                />
              </div>
              <div>
                <Label>Unit Kerja</Label>
                <Input
                  value={nom.uker}
                  onChange={(e) => setNom((n) => ({ ...n, uker: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNomOpen(false)}>
              Batal
            </Button>
            <Button onClick={() => void saveNom()}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Foto Pekerja di Database</DialogTitle>
          </DialogHeader>
          {photos.isLoading ? (
            <p className="text-sm text-muted-foreground">Memuat foto...</p>
          ) : (photos.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada foto untuk pekerja ini di database.
            </p>
          ) : (
            <div className="grid max-h-[60vh] grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-4">
              {(photos.data ?? []).map((p, i) => (
                <button
                  key={`${p.url}-${i}`}
                  type="button"
                  className="group overflow-hidden rounded-md border border-border"
                  onClick={() => void usePhoto(p.url)}
                >
                  <img
                    src={p.url}
                    alt={p.label}
                    loading="lazy"
                    decoding="async"
                    className="transition group-hover:scale-105"
                    style={{
                      display: "block",
                      width: "100%",
                      aspectRatio: "1 / 1",
                      objectFit: "cover",
                      objectPosition: "50% 20%",
                    }}
                  />
                  <span className="block truncate p-1 text-[10px] text-muted-foreground">
                    {p.label}
                  </span>
                </button>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPickerOpen(false)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PhotoCropDialog
        open={!!cropSrc}
        src={cropSrc}
        onOpenChange={(v) => {
          if (!v) setCropSrc(null);
        }}
        onDone={(url) => setNom((n) => ({ ...n, foto: url }))}
      />

    </AdminPage>
  );
}
