import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { FolderUp, ImagePlus, RefreshCw, ScanFace, Upload, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { db } from "@/lib/face";
import {
  FACE_SERVICE_URL,
  IMAGE_EXT,
  currentUserId,
  embedEventPhoto,
  embedMasterPhoto,
  faceServiceOnline,
  matchFace,
  uploadToDrive,
} from "@/lib/face-service";

type EventOpt = {
  id: string;
  nama_event: string;
  tanggal_mulai: string | null;
  drive_folder_id: string | null;
};
type Item = {
  key: string;
  file: File;
  state: "wait" | "run" | "done" | "skip" | "error";
  info: string;
};

const today = () => new Date().toISOString().slice(0, 10);

export function EventUploadDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}) {
  const [eventId, setEventId] = useState<string>("new");
  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState(today());
  const [mode, setMode] = useState<"wajah" | "cepat">("wajah");
  const [items, setItems] = useState<Item[]>([]);
  const [running, setRunning] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [online, setOnline] = useState<boolean | null>(null);
  const stopRef = useRef(false);
  const autoSynced = useRef(false);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);

  const log = useCallback((m: string) => setLogs((l) => [m, ...l].slice(0, 80)), []);

  const events = useQuery({
    queryKey: ["upload-dialog-events"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await db
        .from("events")
        .select("id,nama_event,tanggal_mulai,drive_folder_id")
        .order("tanggal_mulai", { ascending: false, nullsFirst: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as EventOpt[];
    },
  });

  const stats = useQuery({
    queryKey: ["upload-dialog-face-stats"],
    enabled: open,
    queryFn: async () => {
      const cnt = async (table: string, status?: string) => {
        let q = db.from(table).select("id", { count: "exact", head: true });
        if (status) q = q.eq("status", status);
        const { count } = await q;
        return count ?? 0;
      };
      const [workers, indexed, pending, failed] = await Promise.all([
        cnt("employees"),
        cnt("worker_faces", "indexed"),
        cnt("worker_faces", "pending"),
        cnt("worker_faces", "failed"),
      ]);
      return { workers, indexed, pending, failed };
    },
  });

  useEffect(() => {
    if (!open) return;
    let alive = true;
    void faceServiceOnline().then((v) => alive && setOnline(v));
    return () => {
      alive = false;
    };
  }, [open]);

  useEffect(() => {
    if (online === false && mode === "wajah") setMode("cepat");
  }, [online, mode]);

  const selectedEvent = useMemo(
    () => (events.data ?? []).find((e) => e.id === eventId) ?? null,
    [events.data, eventId],
  );

  // Sinkron wajah master: ambil foto master 'pending' (atau 'failed' jika manual) lalu simpan embedding.
  const syncFaces = useCallback(
    async (includeFailed: boolean) => {
      if (syncing) return;
      setSyncing(true);
      try {
        const statuses = includeFailed ? ["pending", "failed"] : ["pending"];
        const { data, error } = await db
          .from("worker_faces")
          .select("id,personal_number,reference_photo_url")
          .in("status", statuses);
        if (error) throw error;
        const rows = (data ?? []) as {
          id: string;
          personal_number: string;
          reference_photo_url: string | null;
        }[];
        log(`Sinkron wajah master: ${rows.length} data menunggu.`);
        let ok = 0;
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i]!;
          const tag = `[${i + 1}/${rows.length}] ${r.personal_number}`;
          try {
            if (!r.reference_photo_url) {
              await db
                .from("worker_faces")
                .update({ status: "failed", note: "Foto master belum diunggah" })
                .eq("id", r.id);
              log(`${tag}: tidak ada foto.`);
              continue;
            }
            const img = await fetch(r.reference_photo_url);
            if (!img.ok) throw new Error(`unduh foto [${img.status}]`);
            const res = await embedMasterPhoto(await img.blob(), `${r.personal_number}.jpg`);
            if (!res.found || !res.embedding) {
              await db
                .from("worker_faces")
                .update({ status: "failed", note: "Wajah tidak terdeteksi pada foto master" })
                .eq("id", r.id);
              log(`${tag}: wajah tidak terdeteksi.`);
              continue;
            }
            const payload = {
              embedding: res.embedding as unknown as string,
              status: "indexed",
              note: null,
              quality: res.quality ?? null,
            };
            let up = await db.from("worker_faces").update(payload).eq("id", r.id);
            if (up.error) {
              const { quality: _q, ...rest } = payload;
              up = await db.from("worker_faces").update(rest).eq("id", r.id);
            }
            if (up.error) throw new Error(up.error.message);
            ok += 1;
            log(`${tag}: terindeks.`);
          } catch (e) {
            log(`${tag}: gagal — ${(e as Error).message}`);
          }
        }
        log(`Sinkron selesai: ${ok} wajah baru terindeks.`);
        await stats.refetch();
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setSyncing(false);
      }
    },
    [syncing, log, stats],
  );

  // Saat pertama dibuka: jika ada wajah baru (pending) dan mesin aktif, sinkron otomatis.
  useEffect(() => {
    if (!open) {
      autoSynced.current = false;
      return;
    }
    if (online && stats.data && !autoSynced.current) {
      autoSynced.current = true;
      if (stats.data.pending > 0) void syncFaces(false);
    }
  }, [open, online, stats.data, syncFaces]);

  function addFiles(list: FileList | File[] | null) {
    if (!list) return;
    const have = new Set(items.map((i) => i.key));
    const next: Item[] = [];
    for (const f of Array.from(list)) {
      if (!IMAGE_EXT.test(f.name)) continue;
      const key = `${f.name}:${f.size}:${f.lastModified}`;
      if (have.has(key)) continue;
      have.add(key);
      next.push({ key, file: f, state: "wait", info: "Menunggu" });
    }
    if (next.length === 0) {
      toast.info("Tidak ada foto baru (JPG, PNG, WEBP, BMP).");
      return;
    }
    setItems((cur) => [...cur, ...next]);
  }

  const patch = (key: string, p: Partial<Item>) =>
    setItems((cur) => cur.map((i) => (i.key === key ? { ...i, ...p } : i)));

  async function start() {
    const name = (eventId === "new" ? newName : (selectedEvent?.nama_event ?? "")).trim();
    if (!name) return toast.error("Isi nama event terlebih dahulu.");
    if (items.length === 0) return toast.error("Pilih foto terlebih dahulu.");
    if (mode === "wajah" && !online)
      return toast.error("Mesin wajah belum aktif. Gunakan Upload cepat.");
    if (mode === "wajah" && (stats.data?.indexed ?? 0) === 0) {
      return toast.error("Belum ada wajah pekerja yang terindeks. Jalankan Sinkron wajah dahulu.");
    }

    stopRef.current = false;
    setRunning(true);
    try {
      const uid = await currentUserId();
      let ev = selectedEvent;
      if (eventId === "new") {
        const { data, error } = await db
          .from("events")
          .insert({ nama_event: name, tanggal_mulai: newDate || null })
          .select("id,nama_event,tanggal_mulai,drive_folder_id")
          .single();
        if (error) throw new Error(`Gagal membuat event: ${error.message}`);
        ev = data as EventOpt;
        setEventId(ev.id);
        await events.refetch();
        log(`Event "${name}" dibuat.`);
      }
      if (!ev) throw new Error("Event tidak ditemukan.");
      let folderId = ev.drive_folder_id;

      const { data: existing } = await db
        .from("event_photos")
        .select("file_name")
        .eq("event_id", ev.id)
        .limit(10000);
      const doneNames = new Set(
        ((existing ?? []) as { file_name: string | null }[])
          .map((r) => r.file_name ?? "")
          .map((n) => n.replace(/^EVT-[^_]+_[^_]+_/, "")),
      );

      let uploaded = 0;
      for (const it of items) {
        if (stopRef.current) {
          log("Dihentikan pengguna.");
          break;
        }
        if (it.state === "done" || it.state === "skip") continue;
        const base = it.file.name;
        if (doneNames.has(base)) {
          patch(it.key, { state: "skip", info: "Dilewati (sudah ada di event)" });
          continue;
        }
        patch(it.key, { state: "run", info: mode === "wajah" ? "Membaca wajah…" : "Mengunggah…" });
        try {
          const ids: string[] = [];
          const pns: string[] = [];
          let faces = 0;
          if (mode === "wajah") {
            const res = await embedEventPhoto(it.file, base);
            faces = res.faces;
            for (const emb of res.embeddings) {
              for (const m of await matchFace(emb)) {
                if (m.worker_id && !ids.includes(m.worker_id)) {
                  ids.push(m.worker_id);
                  if (m.personal_number) pns.push(m.personal_number);
                }
              }
            }
            patch(it.key, { info: `${faces} wajah · ${ids.length} cocok — mengunggah…` });
          }
          const fileName = `EVT-${ev.id}_${pns.length ? pns.join("-") : "NOMATCH"}_${base}`;
          const up = await uploadToDrive(name, it.file, fileName);
          if (!folderId) {
            folderId = up.folderId;
            await db.from("events").update({ drive_folder_id: folderId }).eq("id", ev.id);
          }
          const { error } = await db.from("event_photos").insert({
            event_id: ev.id,
            drive_file_id: up.id,
            drive_view_link: up.link,
            file_name: fileName,
            matched_worker_ids: ids,
            uploaded_by: uid,
          });
          if (error && !/duplicate|unique/i.test(error.message)) throw new Error(error.message);
          uploaded += 1;
          patch(it.key, {
            state: "done",
            info: mode === "wajah" ? `${faces} wajah · ${ids.length} pekerja cocok` : "Diunggah",
          });
          log(`${base}: ${mode === "wajah" ? `${ids.length} pekerja cocok → ` : ""}diunggah.`);
        } catch (e) {
          patch(it.key, { state: "error", info: (e as Error).message.slice(0, 120) });
          log(`${base}: gagal — ${(e as Error).message}`);
        }
      }
      toast.success(`Selesai: ${uploaded} foto diunggah.`);
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  const total = items.length;
  const finished = items.filter(
    (i) => i.state === "done" || i.state === "skip" || i.state === "error",
  ).length;
  const pct = total ? Math.round((finished / total) * 100) : 0;
  const st = stats.data;
  const dirRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    dirRef.current?.setAttribute("webkitdirectory", "");
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => (!running ? onOpenChange(v) : toast.info("Hentikan proses dahulu."))}
    >
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b border-border/60 px-5 py-4">
          <DialogTitle>Upload Foto Event</DialogTitle>
          <DialogDescription>
            Buat event, unggah ke Google Drive, dan kenali wajah pekerja otomatis — seperti aplikasi
            companion.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto md:grid-cols-[330px_1fr] md:overflow-hidden">
          <div className="space-y-5 border-b border-border/60 p-5 md:overflow-y-auto md:border-r md:border-b-0">
            <section className="space-y-2">
              <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                1. Wajah master
              </p>
              <div className="space-y-1 rounded-xl border border-border/60 p-3 text-sm">
                {stats.isLoading || online === null ? (
                  <p className="text-muted-foreground">Memeriksa data wajah…</p>
                ) : (
                  <>
                    <p>
                      <b>{st?.indexed ?? 0}</b> dari <b>{st?.workers ?? 0}</b> pekerja sudah
                      tersinkron.
                    </p>
                    <p className="text-muted-foreground">
                      Wajah baru menunggu: <b>{st?.pending ?? 0}</b> · gagal:{" "}
                      <b>{st?.failed ?? 0}</b>
                    </p>
                    <p className={online ? "text-emerald-600" : "text-amber-600"}>
                      {online
                        ? "Mesin wajah aktif."
                        : FACE_SERVICE_URL
                          ? "Mesin wajah tidak terjangkau."
                          : "Mesin wajah belum dihubungkan (lihat face-service/README)."}
                    </p>
                  </>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-2 w-full"
                  disabled={!online || syncing || running}
                  onClick={() => void syncFaces(true)}
                >
                  <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "Menyinkronkan…" : "Sinkron wajah sekarang"}
                </Button>
              </div>
            </section>

            <section className="space-y-2">
              <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                2. Event tujuan
              </p>
              <select
                value={eventId}
                onChange={(e) => setEventId(e.target.value)}
                disabled={running}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="new">+ Buat event baru</option>
                {(events.data ?? []).map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nama_event}
                  </option>
                ))}
              </select>
              {eventId === "new" ? (
                <div className="space-y-2">
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nama event"
                    disabled={running}
                  />
                  <Input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    disabled={running}
                  />
                  <p className="text-xs text-muted-foreground">
                    Folder Google Drive otomatis dibuat: SUPER IT DATA ▸ Event ▸ nama event.
                  </p>
                </div>
              ) : null}
            </section>

            <section className="space-y-2">
              <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                3. Cara proses
              </p>
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
                <button
                  type="button"
                  disabled={!online || running}
                  onClick={() => setMode("wajah")}
                  className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-bold disabled:opacity-40 ${mode === "wajah" ? "bg-primary text-primary-foreground" : ""}`}
                >
                  <ScanFace className="size-4" /> Kenali wajah
                </button>
                <button
                  type="button"
                  disabled={running}
                  onClick={() => setMode("cepat")}
                  className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-bold ${mode === "cepat" ? "bg-primary text-primary-foreground" : ""}`}
                >
                  <Zap className="size-4" /> Upload cepat
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {mode === "wajah"
                  ? "Setiap wajah dicocokkan ke data pekerja; foto otomatis masuk galeri pekerja yang cocok."
                  : "Langsung ke Google Drive tanpa pembacaan wajah (ditandai NOMATCH)."}
              </p>
            </section>
          </div>

          <div
            className={`flex min-h-[320px] flex-col gap-3 p-5 md:min-h-0 ${dragging ? "bg-primary/5" : ""}`}
            onDragEnter={(e) => {
              e.preventDefault();
              dragDepth.current += 1;
              setDragging(true);
            }}
            onDragLeave={() => {
              dragDepth.current = Math.max(0, dragDepth.current - 1);
              if (dragDepth.current === 0) setDragging(false);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              dragDepth.current = 0;
              setDragging(false);
              if (!running) addFiles(e.dataTransfer.files);
            }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="mr-auto text-sm font-bold">4. Foto &amp; proses</p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <input
                ref={dirRef}
                type="file"
                multiple
                hidden
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={running}
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus className="size-4" /> Pilih foto
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={running}
                onClick={() => dirRef.current?.click()}
              >
                <FolderUp className="size-4" /> Pilih folder
              </Button>
              {items.length > 0 && !running ? (
                <Button size="sm" variant="ghost" onClick={() => setItems([])}>
                  Kosongkan
                </Button>
              ) : null}
            </div>

            {items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-8 text-center">
                <Upload className="size-10 text-primary" />
                <p className="font-semibold">Seret foto ke sini</p>
                <p className="text-xs text-muted-foreground">
                  atau gunakan tombol Pilih foto / Pilih folder
                </p>
              </div>
            ) : (
              <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
                {items.map((it) => (
                  <div
                    key={it.key}
                    className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-1.5 text-xs"
                  >
                    <span className="w-40 shrink-0 truncate font-semibold">{it.file.name}</span>
                    <span
                      className={`min-w-0 flex-1 truncate ${it.state === "error" ? "text-destructive" : "text-muted-foreground"}`}
                    >
                      {it.info}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        it.state === "done"
                          ? "bg-emerald-100 text-emerald-800"
                          : it.state === "error"
                            ? "bg-red-100 text-red-800"
                            : it.state === "run"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {it.state === "done"
                        ? "Selesai"
                        : it.state === "error"
                          ? "Gagal"
                          : it.state === "run"
                            ? "Proses"
                            : it.state === "skip"
                              ? "Lewati"
                              : "Menunggu"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {logs.length > 0 ? (
              <div className="max-h-20 overflow-y-auto rounded-lg bg-muted/60 p-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
                {logs.slice(0, 6).map((l, i) => (
                  <div key={i}>{l}</div>
                ))}
              </div>
            ) : null}

            <div className="flex items-center gap-3 border-t border-border/60 pt-3">
              <div className="flex-1">
                <div className="mb-1 flex justify-between text-xs font-semibold">
                  <span>
                    {finished} dari {total} foto
                  </span>
                  <span>{pct}%</span>
                </div>
                <Progress value={pct} />
              </div>
              {running ? (
                <Button variant="destructive" onClick={() => (stopRef.current = true)}>
                  Hentikan
                </Button>
              ) : (
                <Button onClick={() => void start()} disabled={items.length === 0 || syncing}>
                  <Upload className="size-4" /> Mulai proses &amp; upload
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
