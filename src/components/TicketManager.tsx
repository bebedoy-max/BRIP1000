import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import {
  Camera,
  CheckCircle2,
  HandHelping,
  ImagePlus,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
  Undo2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAccess } from "@/lib/access";
import { useDirectory } from "@/lib/directory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CameraCapture } from "@/components/CameraCapture";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const db = supabase as unknown as SupabaseClient;
const BUCKET = "ticket-photos";

export type TicketStatus = "open" | "in_progress" | "finish" | "done";

type Ticket = {
  id: string;
  judul: string;
  deskripsi: string | null;
  foto_url: string | null;
  reporter_nama: string | null;
  reporter_uker: string | null;
  reported_by: string | null;
  handled_by: string | null;
  handled_at: string | null;
  catatan_tindak_lanjut: string | null;
  solusi: string | null;
  foto_solusi_url: string | null;
  finished_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  status: TicketStatus;
  created_at: string;
  resolved_at: string | null;
};

const statusMeta: Record<TicketStatus, { label: string; className: string }> = {
  open: { label: "Open", className: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  in_progress: { label: "In Progress", className: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
  finish: {
    label: "Finish — Menunggu Approval",
    className: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  },
  done: {
    label: "Done",
    className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40 ticket-done-pulse",
  },
};

function fmt(v: string | null) {
  if (!v) return "-";
  return new Date(v).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

function useTickets() {
  return useQuery({
    queryKey: ["it_tickets"],
    queryFn: async () => {
      const { data, error } = await db
        .from("it_tickets")
        .select(
          "id,judul,deskripsi,foto_url,reporter_nama,reporter_uker,reported_by,handled_by,handled_at,catatan_tindak_lanjut,solusi,foto_solusi_url,finished_at,approved_by,approved_at,status,created_at,resolved_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Ticket[];
    },
  });
}

/** Menu Tiket IT: manajemen membuat & menyetujui, petugas IT menindaklanjuti. */
export function TicketManager() {
  const access = useAccess();
  const dir = useDirectory();
  const qc = useQueryClient();
  const tickets = useTickets();

  const isPetugasIt = access.level === "super_admin" || access.level === "admin";
  const canCreate = access.level === "super_admin" || access.level === "manajemen";

  const [open, setOpen] = useState(false);
  const [judul, setJudul] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // Dialog penyelesaian oleh petugas IT
  const [finishFor, setFinishFor] = useState<Ticket | null>(null);
  const [keterangan, setKeterangan] = useState("");
  const [buktiFile, setBuktiFile] = useState<File | null>(null);
  const [camOpen, setCamOpen] = useState(false);

  const rows = useMemo(() => tickets.data ?? [], [tickets.data]);
  const mine = useMemo(() => rows.filter((t) => t.reported_by === dir.myId), [rows, dir.myId]);
  const list = isPetugasIt ? rows : mine;

  async function uploadFoto(f: File, prefix: string) {
    const ext = f.name.split(".").pop() || "jpg";
    const path = `${prefix}/${dir.myId}/${Date.now()}.${ext}`;
    const { error } = await db.storage.from(BUCKET).upload(path, f, { upsert: true });
    if (error) throw error;
    return db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  const create = useMutation({
    mutationFn: async () => {
      if (!judul.trim()) throw new Error("Judul tiket wajib diisi.");
      const foto_url = file ? await uploadFoto(file, "laporan") : null;
      const { error } = await db.from("it_tickets").insert({
        judul: judul.trim(),
        deskripsi: deskripsi.trim() || null,
        foto_url,
        reported_by: dir.myId,
        status: "open",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tiket IT berhasil dibuat.");
      setOpen(false);
      setJudul("");
      setDeskripsi("");
      setFile(null);
      void qc.invalidateQueries({ queryKey: ["it_tickets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async (v: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await db.from("it_tickets").update(v.patch).eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["it_tickets"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const finish = useMutation({
    mutationFn: async () => {
      const t = finishFor;
      if (!t) return;
      if (!keterangan.trim()) throw new Error("Keterangan penyelesaian wajib diisi.");
      if (!buktiFile) throw new Error("Foto bukti penyelesaian wajib dilampirkan.");
      const foto_solusi_url = await uploadFoto(buktiFile, "solusi");
      const now = new Date().toISOString();
      const { error } = await db
        .from("it_tickets")
        .update({
          status: "finish",
          solusi: keterangan.trim(),
          foto_solusi_url,
          finished_at: now,
          handled_by: t.handled_by ?? dir.myId,
          handled_at: t.handled_at ?? now,
        })
        .eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tiket ditandai selesai. Menunggu approval pembuat tiket.");
      setFinishFor(null);
      setKeterangan("");
      setBuktiFile(null);
      setCamOpen(false);
      void qc.invalidateQueries({ queryKey: ["it_tickets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.rpc("approve_ticket", { _ticket_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tiket disetujui — status Done dan tercatat di Buku Harian IT.");
      void qc.invalidateQueries({ queryKey: ["it_tickets"] });
      void qc.invalidateQueries({ queryKey: ["it_diary_logs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.rpc("reject_ticket", { _ticket_id: id, _alasan: null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Penyelesaian ditolak, tiket kembali In Progress.");
      void qc.invalidateQueries({ queryKey: ["it_tickets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from("it_tickets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tiket dihapus.");
      void qc.invalidateQueries({ queryKey: ["it_tickets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handover(t: Ticket) {
    update.mutate(
      {
        id: t.id,
        patch: {
          status: "in_progress",
          handled_by: dir.myId,
          handled_at: new Date().toISOString(),
        },
      },
      { onSuccess: () => toast.success("Tiket diambil untuk ditindaklanjuti.") },
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">
            <span className="gradient-text">Tiket IT</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isPetugasIt
              ? "Tindak lanjuti tiket, lampirkan keterangan & foto bukti saat selesai, lalu tunggu approval pembuat tiket."
              : "Buka tiket keluhan IT dan setujui hasil penyelesaian dari petugas IT."}
          </p>
        </div>
        {canCreate ? (
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Buat Tiket
          </Button>
        ) : null}
      </div>

      {tickets.isLoading ? (
        <div className="glass-card mt-6 p-10 text-center text-sm text-muted-foreground">
          Memuat tiket…
        </div>
      ) : list.length === 0 ? (
        <div className="glass-card mt-6 p-10 text-center text-sm text-muted-foreground">
          {isPetugasIt ? "Belum ada tiket masuk." : "Anda belum membuat tiket."}
        </div>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {list.map((t) => {
            const meta = statusMeta[t.status] ?? statusMeta.open;
            const isReporter = t.reported_by === dir.myId;
            return (
              <div key={t.id} className="glass-card flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{t.judul}</h2>
                    <p className="text-xs text-muted-foreground">{fmt(t.created_at)}</p>
                  </div>
                  <Badge variant="outline" className={meta.className}>
                    {meta.label}
                  </Badge>
                </div>

                {t.deskripsi ? (
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground">{t.deskripsi}</p>
                ) : null}

                {t.foto_url ? (
                  <a href={t.foto_url} target="_blank" rel="noreferrer">
                    <img
                      src={t.foto_url}
                      alt={`Foto tiket ${t.judul}`}
                      loading="lazy"
                      className="max-h-56 w-full rounded-xl object-cover"
                    />
                  </a>
                ) : null}

                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Pembuat</dt>
                    <dd>{t.reporter_nama || dir.nameOf(t.reported_by ?? "")}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Unit Kerja</dt>
                    <dd>{t.reporter_uker || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Petugas IT</dt>
                    <dd>{t.handled_by ? dir.nameOf(t.handled_by) : "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Disetujui</dt>
                    <dd>{fmt(t.approved_at)}</dd>
                  </div>
                </dl>

                {t.solusi || t.foto_solusi_url ? (
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      Keterangan penyelesaian
                    </p>
                    {t.solusi ? (
                      <p className="mt-1 text-sm whitespace-pre-wrap">{t.solusi}</p>
                    ) : null}
                    {t.foto_solusi_url ? (
                      <a href={t.foto_solusi_url} target="_blank" rel="noreferrer">
                        <img
                          src={t.foto_solusi_url}
                          alt={`Bukti penyelesaian ${t.judul}`}
                          loading="lazy"
                          className="mt-2 max-h-48 w-full rounded-lg object-cover"
                        />
                      </a>
                    ) : null}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {isPetugasIt && t.status === "open" ? (
                    <Button size="sm" onClick={() => handover(t)} disabled={update.isPending}>
                      {update.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <HandHelping className="size-4" />
                      )}
                      Tindak Lanjuti
                    </Button>
                  ) : null}

                  {isPetugasIt && t.status === "in_progress" ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setFinishFor(t);
                        setKeterangan(t.solusi ?? "");
                        setBuktiFile(null);
                        setCamOpen(false);
                      }}
                    >
                      <CheckCircle2 className="size-4" /> Selesai
                    </Button>
                  ) : null}

                  {isPetugasIt && t.status === "finish" ? (
                    <span className="text-xs text-muted-foreground">
                      Menunggu approval pembuat tiket.
                    </span>
                  ) : null}

                  {isReporter && t.status === "finish" ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() => approve.mutate(t.id)}
                        disabled={approve.isPending}
                      >
                        {approve.isPending ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <ShieldCheck className="size-4" />
                        )}
                        Setujui Selesai
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => reject.mutate(t.id)}
                        disabled={reject.isPending}
                      >
                        <Undo2 className="size-4" /> Belum Selesai
                      </Button>
                    </>
                  ) : null}

                  {isPetugasIt || (isReporter && t.status === "open") ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => remove.mutate(t.id)}
                      disabled={remove.isPending}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buat Tiket IT</DialogTitle>
            <DialogDescription>
              Nama pembuat, unit kerja, tanggal, dan status Open terisi otomatis oleh sistem.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="judul">Judul</Label>
              <Input
                id="judul"
                value={judul}
                onChange={(e) => setJudul(e.target.value)}
                placeholder="Contoh: Printer teller tidak terdeteksi"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="deskripsi">Deskripsi Problem</Label>
              <Textarea
                id="deskripsi"
                rows={4}
                value={deskripsi}
                onChange={(e) => setDeskripsi(e.target.value)}
                placeholder="Jelaskan kendala yang dialami"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="foto" className="flex items-center gap-2">
                <ImagePlus className="size-4" /> Foto (opsional)
              </Label>
              <Input
                id="foto"
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Submit Tiket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!finishFor} onOpenChange={(v) => (v ? null : setFinishFor(null))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Selesaikan Tiket</DialogTitle>
            <DialogDescription>
              Keterangan dan foto bukti wajib diisi. Status menjadi Finish dan menunggu approval
              pembuat tiket.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="keterangan">Keterangan Penyelesaian</Label>
              <Textarea
                id="keterangan"
                rows={4}
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                placeholder="Tindakan yang dilakukan hingga problem teratasi"
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="flex items-center gap-2">
                <ImagePlus className="size-4" /> Foto Bukti
              </Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setBuktiFile(e.target.files?.[0] ?? null)}
              />
              {camOpen ? (
                <CameraCapture
                  onCapture={(f) => setBuktiFile(f)}
                  onClose={() => setCamOpen(false)}
                />
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="justify-self-start"
                  onClick={() => setCamOpen(true)}
                >
                  <Camera className="size-4" /> Foto dengan Kamera
                </Button>
              )}
              {buktiFile ? (
                <img
                  src={URL.createObjectURL(buktiFile)}
                  alt="Pratinjau bukti penyelesaian"
                  className="max-h-48 w-full rounded-xl object-cover"
                />
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setFinishFor(null)}>
              Batal
            </Button>
            <Button onClick={() => finish.mutate()} disabled={finish.isPending}>
              {finish.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Tandai Selesai
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
