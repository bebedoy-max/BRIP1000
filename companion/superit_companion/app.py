"""GUI desktop SuperIT Event Uploader (Tkinter, tema mengikuti web app SuperIT)."""

import threading
import tkinter as tk
from datetime import date
from tkinter import filedialog, messagebox, ttk
from typing import Dict, List, Optional

from . import __version__
from .backend import Backend
from .config import Config
from .defaults import APP_NAME
from .drive import Drive
from .faces import FaceEngine
from .processor import collect_images, process_event_photos, sync_master_faces
from . import theme as T


class App(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title(f"{APP_NAME} v{__version__}")
        self.geometry("960x720")
        self.minsize(880, 640)
        T.apply_theme(self)

        self.cfg = Config.load()
        self.backend: Optional[Backend] = None
        self.engine: Optional[FaceEngine] = None
        self.drive: Optional[Drive] = None
        self.events: List[Dict[str, str]] = []
        self.files: List[str] = []
        self._stop = False

        self._build_header()

        self._build_footer()

        nb = ttk.Notebook(self)
        nb.pack(fill="both", expand=True, padx=18)
        self.tab_conn = ttk.Frame(nb, padding=18)
        self.tab_sync = ttk.Frame(nb, padding=18)
        self.tab_event = ttk.Frame(nb, padding=18)
        nb.add(self.tab_conn, text="Koneksi")
        nb.add(self.tab_sync, text="Sinkron Wajah")
        nb.add(self.tab_event, text="Proses Foto Event")

        self._build_conn()
        self._build_sync()
        self._build_event()

    # ---------- shell ----------
    def _build_header(self) -> None:
        head = ttk.Frame(self, padding=(18, 16, 18, 6))
        head.pack(fill="x")
        ttk.Label(head, text=APP_NAME, style="Title.TLabel").pack(anchor="w")
        ttk.Label(
            head,
            text="Sinkron wajah master, cocokkan foto event, dan unggah otomatis ke Google Drive.",
            style="Muted.TLabel",
        ).pack(anchor="w", pady=(2, 0))
        self.lbl_status = ttk.Label(head, text="● Belum terhubung", style="Muted.TLabel")
        self.lbl_status.pack(anchor="w", pady=(8, 0))

    def _build_footer(self) -> None:
        wrap = ttk.Frame(self, padding=(18, 10, 18, 16))
        wrap.pack(side="bottom", fill="x")
        self.progress = ttk.Progressbar(wrap, mode="determinate")
        self.progress.pack(fill="x", pady=(0, 10))
        self.log_box = tk.Text(
            wrap,
            height=11,
            state="disabled",
            bg=T.SURFACE,
            fg=T.FG,
            insertbackground=T.FG,
            relief="flat",
            highlightthickness=1,
            highlightbackground=T.BORDER,
            highlightcolor=T.BORDER,
            font=T.FONT_MONO,
            padx=12,
            pady=10,
            wrap="word",
        )
        self.log_box.pack(fill="both", expand=True)

    def set_status(self, text: str, ok: bool = False) -> None:
        self.after(
            0,
            lambda: self.lbl_status.configure(
                text=("● " + text), style="Accent.TLabel" if ok else "Muted.TLabel"
            ),
        )

    # ---------- util ----------
    def log(self, msg: str) -> None:
        def _append() -> None:
            self.log_box.configure(state="normal")
            self.log_box.insert("end", msg + "\n")
            self.log_box.see("end")
            self.log_box.configure(state="disabled")

        self.after(0, _append)

    def set_progress(self, done: int, total: int) -> None:
        self.after(0, lambda: self._set_progress(done, total))

    def _set_progress(self, done: int, total: int) -> None:
        self.progress["maximum"] = max(total, 1)
        self.progress["value"] = done

    def run_bg(self, fn) -> None:
        threading.Thread(target=self._guard(fn), daemon=True).start()

    def _guard(self, fn):
        def wrapper() -> None:
            try:
                fn()
            except Exception as err:  # noqa: BLE001
                detail = str(err).strip() or repr(err)
                message = f"{type(err).__name__}: {detail}"
                self.log(f"ERROR: {message}")
                self.after(0, lambda: messagebox.showerror(APP_NAME, message))

        return wrapper

    def _card(self, parent, title: str, subtitle: str = "") -> ttk.Frame:
        card = ttk.Frame(parent, style="Card.TFrame", padding=16)
        card.pack(fill="x", pady=(0, 14))
        ttk.Label(card, text=title, style="Card.TLabel", font=T.FONT_BOLD).grid(
            row=0, column=0, columnspan=3, sticky="w"
        )
        if subtitle:
            ttk.Label(card, text=subtitle, style="CardMuted.TLabel", justify="left").grid(
                row=1, column=0, columnspan=3, sticky="w", pady=(2, 10)
            )
        card.columnconfigure(1, weight=1)
        return card

    # ---------- tab koneksi ----------
    def _build_conn(self) -> None:
        f = self.tab_conn
        self.v_email = tk.StringVar(value=self.cfg.admin_email)
        self.v_pass = tk.StringVar(value=self.cfg.admin_password)
        self.v_panel = tk.StringVar(value=self.cfg.panel_url)
        self.v_thr = tk.DoubleVar(value=self.cfg.match_threshold)

        info = self._card(
            f,
            "Server panel",
            "Supabase & Google Drive otomatis mengikuti web app SuperIT — cukup login admin.",
        )
        ttk.Label(info, text="Endpoint", style="CardMuted.TLabel").grid(
            row=2, column=0, sticky="w", pady=3
        )
        ttk.Label(info, text=self.cfg.supabase_url, style="Card.TLabel").grid(
            row=2, column=1, sticky="w", padx=10
        )
        ttk.Label(info, text="Kunci publik", style="CardMuted.TLabel").grid(
            row=3, column=0, sticky="w", pady=3
        )
        ttk.Label(info, text="tersinkron otomatis ✓", style="Card.TLabel").grid(
            row=3, column=1, sticky="w", padx=10
        )
        ttk.Label(info, text="Google Drive", style="CardMuted.TLabel").grid(
            row=4, column=0, sticky="w", pady=3
        )
        self.lbl_drive = ttk.Label(info, text="cek saat menghubungkan…", style="Card.TLabel")
        self.lbl_drive.grid(row=4, column=1, sticky="w", padx=10)

        login = self._card(f, "Masuk sebagai admin", "Gunakan akun panel (it_admin / superadmin).")
        rows = [
            ("Email admin", self.v_email, False),
            ("Password admin", self.v_pass, True),
            ("Alamat web app SuperIT", self.v_panel, False),
        ]
        for i, (label, var, secret) in enumerate(rows, start=2):
            ttk.Label(login, text=label, style="CardMuted.TLabel").grid(
                row=i, column=0, sticky="w", pady=6
            )
            ttk.Entry(login, textvariable=var, width=52, show="*" if secret else "").grid(
                row=i, column=1, sticky="we", padx=10
            )
        ttk.Label(login, text="Threshold kemiripan", style="CardMuted.TLabel").grid(
            row=5, column=0, sticky="w", pady=6
        )
        ttk.Spinbox(
            login, from_=0.3, to=0.95, increment=0.05, textvariable=self.v_thr, width=8
        ).grid(row=5, column=1, sticky="w", padx=10)
        self.btn_connect = ttk.Button(
            login,
            text="Hubungkan",
            style="Primary.TButton",
            command=self.start_connect,
        )
        self.btn_connect.grid(row=6, column=1, sticky="w", padx=10, pady=(14, 2))

    def start_connect(self) -> None:
        """Berikan respons langsung sebelum proses koneksi berjalan di background."""
        self.btn_connect.configure(state="disabled", text="Menghubungkan…")
        self.set_status("Menghubungkan…")
        self.log("Tombol Hubungkan diterima. Memulai login admin…")
        self.run_bg(self.connect)

    def connect(self) -> None:
        try:
            self.cfg.admin_email = self.v_email.get().strip()
            self.cfg.admin_password = self.v_pass.get()
            self.cfg.panel_url = self.v_panel.get().strip()
            self.cfg.match_threshold = float(self.v_thr.get())
            self.cfg.save()

            if not self.cfg.admin_email or not self.cfg.admin_password:
                raise RuntimeError("Email dan password admin wajib diisi.")

            self.log("Menghubungkan ke server panel…")
            self.backend = Backend(self.cfg)
            self.backend.sign_in(self.cfg.admin_email, self.cfg.admin_password)
            self.log("Login admin berhasil.")

            self.drive = Drive(self.cfg.panel_url, lambda force=False: self.backend.token(force))
            try:
                st = self.drive.status()
                if st.get("connected"):
                    text = f"aktif — {st.get('email') or st.get('label') or 'akun panel'}"
                    self.log(f"Google Drive web app siap: {text}")
                else:
                    text = "belum ada akun aktif di web app"
                    self.log("Google Drive belum aktif di web app (menu Google Drive).")
            except Exception as err:  # noqa: BLE001
                text = "tidak dapat dihubungi"
                self.log(f"Gagal cek Google Drive: {err}")
            self.after(0, lambda: self.lbl_drive.configure(text=text))

            self.reload_events()
            try:
                self.refresh_face_stats()
            except Exception as err:  # noqa: BLE001
                self.log(f"Gagal memuat statistik wajah: {err}")
            self.log("Memuat model face recognition (unduh sekali di awal)…")
            self.engine = FaceEngine()
            self.log("Model siap.")
            self.set_status(f"Terhubung sebagai {self.cfg.admin_email}", ok=True)
        except Exception as err:  # noqa: BLE001
            self.set_status("Gagal terhubung")
            raise
        finally:
            self.after(
                0,
                lambda: self.btn_connect.configure(state="normal", text="Hubungkan"),
            )

    # ---------- tab sinkron ----------
    def _build_sync(self) -> None:
        f = self.tab_sync
        card = self._card(
            f,
            "Sinkronisasi wajah master",
            "Ambil semua foto master berstatus 'pending', hitung embedding 512 dimensi,\n"
            "lalu tandai 'indexed' atau 'failed' di database.",
        )
        self.btn_sync = ttk.Button(
            card,
            text="Mulai Sinkronisasi",
            style="Primary.TButton",
            command=self.start_sync,
        )
        self.btn_sync.grid(row=2, column=0, sticky="w")
        self.lbl_sync = ttk.Label(card, text="", style="CardMuted.TLabel")
        self.lbl_sync.grid(row=2, column=1, sticky="w", padx=12)

        stat = self._card(
            f,
            "Status index wajah",
            "Ringkasan jumlah pekerja di database dan status index wajahnya.",
        )
        self.lbl_stat_workers = ttk.Label(stat, text="—", style="Card.TLabel")
        self.lbl_stat_indexed = ttk.Label(stat, text="—", style="Card.TLabel")
        self.lbl_stat_pending = ttk.Label(stat, text="—", style="Card.TLabel")
        rows = [
            ("Pekerja terdaftar", self.lbl_stat_workers),
            ("Sudah terindeks", self.lbl_stat_indexed),
            ("Belum terindeks", self.lbl_stat_pending),
        ]
        for i, (label, widget) in enumerate(rows, start=2):
            ttk.Label(stat, text=label, style="CardMuted.TLabel").grid(
                row=i, column=0, sticky="w", pady=3
            )
            widget.grid(row=i, column=1, sticky="w", padx=10)
        ttk.Button(
            stat, text="Muat ulang", command=lambda: self.run_bg(self.refresh_face_stats)
        ).grid(row=5, column=0, sticky="w", pady=(12, 0))

    def refresh_face_stats(self) -> None:
        if not self.backend:
            return
        s = self.backend.face_stats()
        belum = s["pending"] + s["failed"] + s["no_photo"]

        def apply() -> None:
            self.lbl_stat_workers.configure(text=f"{s['workers']} pekerja")
            self.lbl_stat_indexed.configure(text=f"{s['indexed']} wajah")
            self.lbl_stat_pending.configure(
                text=(
                    f"{belum} — {s['no_photo']} tanpa foto, "
                    f"{s['pending']} menunggu, {s['failed']} gagal"
                )
            )

        self.after(0, apply)

    # ---------- animasi loading ----------
    def _spin_start(self, label: ttk.Label, text: str) -> None:
        self._spin_frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
        self._spin_i = 0
        self._spin_on = True

        def tick() -> None:
            if not getattr(self, "_spin_on", False):
                return
            frame = self._spin_frames[self._spin_i % len(self._spin_frames)]
            self._spin_i += 1
            label.configure(text=f"{frame} {text}")
            self.after(90, tick)

        tick()

    def _spin_stop(self, label: ttk.Label, text: str = "") -> None:
        self._spin_on = False
        label.configure(text=text)

    def start_sync(self) -> None:
        if not (self.backend and self.engine):
            messagebox.showwarning(APP_NAME, "Hubungkan dulu di tab Koneksi.")
            return
        self.btn_sync.configure(state="disabled", text="Menyinkronkan…")
        self._spin_start(self.lbl_sync, "Memproses wajah master…")
        self.run_bg(self.do_sync)

    def do_sync(self) -> None:
        try:
            sync_master_faces(self.backend, self.engine, self.log, self.set_progress)
            self.refresh_face_stats()
        finally:
            self.after(0, self._sync_done)

    def _sync_done(self) -> None:
        self._spin_stop(self.lbl_sync, "Selesai.")
        self.btn_sync.configure(state="normal", text="Mulai Sinkronisasi")

    # ---------- tab event ----------
    def _build_event(self) -> None:
        f = self.tab_event
        self.v_event = tk.StringVar()
        self.v_nama = tk.StringVar()
        self.v_tanggal = tk.StringVar(value=date.today().isoformat())
        self.v_desc = tk.StringVar()

        pick = self._card(f, "Pilih event", "Gunakan event yang sudah ada atau buat baru.")
        self.cb_event = ttk.Combobox(pick, textvariable=self.v_event, width=48, state="readonly")
        self.cb_event.grid(row=2, column=0, sticky="we")
        ttk.Button(pick, text="Muat ulang", command=lambda: self.run_bg(self.reload_events)).grid(
            row=2, column=1, sticky="w", padx=10
        )
        ttk.Button(
            pick, text="Hapus Event", style="Danger.TButton", command=self.confirm_delete_event
        ).grid(row=2, column=2, sticky="w", padx=(0, 4))
        pick.columnconfigure(0, weight=1)
        pick.columnconfigure(1, weight=0)
        pick.columnconfigure(2, weight=0)

        new = self._card(f, "Event baru")
        fields = [("Judul", self.v_nama), ("Tanggal (YYYY-MM-DD)", self.v_tanggal), ("Deskripsi", self.v_desc)]
        for i, (label, var) in enumerate(fields, start=2):
            ttk.Label(new, text=label, style="CardMuted.TLabel").grid(
                row=i, column=0, sticky="w", pady=5
            )
            ttk.Entry(new, textvariable=var, width=48).grid(row=i, column=1, sticky="we", padx=10)
        ttk.Button(
            new, text="Simpan Event", command=lambda: self.run_bg(self.create_event)
        ).grid(row=5, column=1, sticky="w", padx=10, pady=(12, 2))

        proc = self._card(f, "Foto event", "Pilih file atau seluruh folder, lalu proses & unggah.")
        ttk.Button(proc, text="Pilih Foto…", command=self.pick_files).grid(row=2, column=0, sticky="w")
        ttk.Button(proc, text="Pilih Folder…", command=self.pick_folder).grid(
            row=2, column=1, sticky="w", padx=10
        )
        self.lbl_files = ttk.Label(proc, text="Belum ada file dipilih", style="CardMuted.TLabel")
        self.lbl_files.grid(row=3, column=0, columnspan=3, sticky="w", pady=(10, 12))
        ttk.Button(
            proc,
            text="Proses & Upload",
            style="Primary.TButton",
            command=lambda: self.run_bg(self.do_process),
        ).grid(row=4, column=0, sticky="w")
        ttk.Button(proc, text="Hentikan", style="Danger.TButton", command=self.stop).grid(
            row=4, column=1, sticky="w", padx=10
        )

    def reload_events(self) -> None:
        if not self.backend:
            return
        self.events = self.backend.list_events()
        labels = [f"{e['nama_event']} — {e.get('tanggal_mulai') or '-'}" for e in self.events]
        self.after(0, lambda: self.cb_event.configure(values=labels))
        self.log(f"{len(self.events)} event dimuat.")

    def create_event(self) -> None:
        if not self.backend:
            self.log("Hubungkan dulu di tab Koneksi.")
            return
        nama = self.v_nama.get().strip()
        if not nama:
            self.log("Judul event wajib diisi.")
            return
        try:
            row = self.backend.upsert_event(
                nama, self.v_desc.get().strip(), self.v_tanggal.get().strip()
            )
        except PermissionError as err:
            self.log(str(err))
            self.after(0, lambda: messagebox.showerror(APP_NAME, str(err)))
            return
        except Exception as err:  # noqa: BLE001
            self.log(self._friendly_error(err))
            return
        self.log(f"Event tersimpan: {row.get('nama_event', nama)}")
        self.reload_events()

    @staticmethod
    def _friendly_error(err: Exception) -> str:
        text = str(err)
        if "row-level security" in text or "42501" in text:
            return (
                "Ditolak Supabase (RLS): policy event belum mengizinkan role akun ini. "
                "Jalankan sql/event-admin-access.sql di SQL Editor Supabase, lalu login ulang."
            )
        return f"Gagal: {text}"

    def confirm_delete_event(self) -> None:
        if not self.backend:
            messagebox.showwarning(APP_NAME, "Hubungkan dulu di tab Koneksi.")
            return
        event = self.selected_event()
        if not event:
            messagebox.showwarning(APP_NAME, "Pilih event yang mau dihapus terlebih dahulu.")
            return
        ok = messagebox.askyesno(
            APP_NAME,
            f"Hapus event \"{event.get('nama_event')}\"?\n\n"
            "Semua data event, foto di web app, serta folder & foto event di Google Drive "
            "akan ikut terhapus. Tindakan ini tidak bisa dibatalkan.",

        )
        if not ok:
            return
        self.run_bg(lambda: self.delete_event(event))

    def delete_event(self, event: Dict[str, str]) -> None:
        try:
            file_ids = self.backend.event_photo_file_ids(event["id"])
        except Exception:  # noqa: BLE001
            file_ids = []
        try:
            if self.drive is None:
                self.drive = Drive(self.cfg.panel_url, lambda force=False: self.backend.token(force))
            if self.drive:

                self.log("Menghapus folder & foto event di Google Drive…")
                info = self.drive.delete_event_folder(str(event.get("nama_event") or ""), file_ids)
                self.log(
                    f"Drive dibersihkan (file: {info.get('deletedFiles', 0)}, "
                    f"folder: {'ya' if info.get('folderDeleted') else 'tidak'})."
                )
        except Exception as err:  # noqa: BLE001
            self.log(f"Gagal hapus di Google Drive: {err}")
            self.after(
                0,
                lambda: messagebox.showerror(
                    APP_NAME,
                    f"Folder event di Google Drive gagal dihapus:\n{err}\n\n"
                    "Data event tidak dihapus agar tidak ada foto tertinggal.",
                ),
            )
            return
        try:
            self.backend.delete_event(event["id"])
        except PermissionError as err:
            self.log(str(err))
            self.after(0, lambda: messagebox.showerror(APP_NAME, str(err)))
            return
        except Exception as err:  # noqa: BLE001
            self.log(self._friendly_error(err))
            return
        self.log(f"Event dihapus: {event.get('nama_event')}")
        self.v_event.set("")
        self.reload_events()


    def pick_files(self) -> None:
        paths = filedialog.askopenfilenames(
            title="Pilih foto event",
            filetypes=[("Gambar", "*.jpg *.jpeg *.png *.webp *.bmp"), ("Semua file", "*.*")],
        )
        self.files = collect_images(list(paths))
        self.lbl_files.configure(text=f"{len(self.files)} foto siap diproses")

    def pick_folder(self) -> None:
        folder = filedialog.askdirectory(title="Pilih folder foto event")
        if not folder:
            return
        self.files = collect_images([folder])
        self.lbl_files.configure(text=f"{len(self.files)} foto siap diproses")

    def selected_event(self) -> Optional[Dict[str, str]]:
        idx = self.cb_event.current()
        if idx < 0 or idx >= len(self.events):
            return None
        return self.events[idx]

    def stop(self) -> None:
        self._stop = True
        self.log("Menghentikan setelah foto berjalan…")

    def do_process(self) -> None:
        if not (self.backend and self.engine):
            self.log("Hubungkan dulu di tab Koneksi.")
            return
        event = self.selected_event()
        if not event:
            self.log("Pilih event terlebih dahulu.")
            return
        if not self.files:
            self.log("Belum ada foto dipilih.")
            return
        if self.drive is None:
            self.drive = Drive(self.cfg.panel_url, lambda force=False: self.backend.token(force))
        self._stop = False
        process_event_photos(
            self.backend,
            self.engine,
            self.drive,
            event,
            self.files,
            self.log,
            self.set_progress,
            should_stop=lambda: self._stop,
        )
        self.reload_events()


def main() -> None:
    try:
        App().mainloop()
    except Exception as err:  # noqa: BLE001
        messagebox.showerror(APP_NAME, str(err))


if __name__ == "__main__":
    main()
