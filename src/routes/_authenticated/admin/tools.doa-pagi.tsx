import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Building2, LayoutDashboard, Loader2, Save, X } from "lucide-react";
import { toast } from "sonner";

import logoBo from "@/assets/doa/b1000.png";
import logoBri from "@/assets/doa/bri.png";
import logoDanantara from "@/assets/doa/danantara.png";
import iconCeklis from "@/assets/doa/ceklis.png";
import iconCircle from "@/assets/doa/circle.png";
import iconSilang from "@/assets/doa/silang.png";
import {
  QRIS_KOSONG,
  isQrisFilled,
  matchKehadiran,
  defaultKehadiranOptions,
  recordKey,
  toIsoDate,
  weekdayLabels,
  weekdayNames,
  workWeekDates,
  weekdayIndex,
  rotateSections,
  defaultDoaLogos,
  type DoaLogo,
  type DoaLogoSettings,
  type DoaPagiRecord,
  type DoaPagiSection,
  type KehadiranOption,
} from "@/lib/doa-pagi-ui";
import {
  getDoaPagiBoard,
  getDoaPagiKehadiranOptions,
  getDoaPagiLogos,
  getDoaPagiRotation,
  listDoaPagiUkers,
  saveDoaPagiRecord,
  saveDoaPagiRecords,
  searchDoaPagiQris,
} from "@/lib/doa-pagi.functions";

export const Route = createFileRoute("/_authenticated/admin/tools/doa-pagi")({
  head: () => ({
    meta: [
      { title: "Absensi, Doa & Briefing Pagi — Panel BRI BO Pringsewu" },
      {
        name: "description",
        content:
          "Tampilan absensi doa & briefing pagi per bagian: absen QRIS, kehadiran harian, dan rekap hari kerja.",
      },
      { property: "og:title", content: "Absensi, Doa & Briefing Pagi — Panel BRI BO Pringsewu" },
      {
        property: "og:description",
        content: "Absensi doa & briefing pagi per bagian unit kerja BRI BO Pringsewu.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

/** Popup pilihan unit kerja sebelum tampilan absensi dibuka. */
function UkerDialog({ onPick }: { onPick: (u: { id: string; nama: string }) => void }) {
  const q = useQuery({ queryKey: ["doa-pagi", "ukers"], queryFn: () => listDoaPagiUkers() });
  const ukers = q.data?.ukers ?? [];
  const counts = q.data?.counts ?? {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="glass-card w-full max-w-lg space-y-4 p-6">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold">
            <Building2 className="size-5" /> Pilih Unit Kerja
          </h1>
          <p className="text-sm text-muted-foreground">
            Tampilan absensi doa & briefing pagi akan menampilkan bagian sesuai unit kerja terpilih.
          </p>
        </div>
        {q.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Memuat unit kerja…
          </p>
        ) : ukers.length ? (
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {ukers.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => onPick(u)}
                className="flex w-full items-center justify-between rounded-xl border border-border/60 px-4 py-3 text-left text-sm transition hover:bg-muted/40"
              >
                <span className="font-medium">{u.nama}</span>
                <span className="text-xs text-muted-foreground">
                  {counts[u.id] ?? 0} bagian
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Belum ada data unit kerja.</p>
        )}
      </div>
    </div>
  );
}

/**
 * Penanda harian: kosong (bulat polos) sampai ada absen pada hari itu,
 * lalu ceklis bila QRIS terisi, silang bila QRIS ditandai kosong.
 * Hari tanpa data tetap menampilkan lingkaran polos tanpa ikon.
 */
function DayMark({ state, anim }: { state: "ok" | "no" | "empty" | "blank"; anim?: boolean }) {
  const isBlank = state === "blank";
  const src = state === "ok" ? iconCeklis : state === "no" ? iconSilang : iconCircle;
  const alt = isBlank
    ? "Tidak ada data absensi"
    : state === "ok"
      ? "Hadir"
      : state === "no"
        ? "Tidak absen QRIS"
        : "Belum ada absensi";
  return (
    <span className={`doa-mark${anim ? " doa-mark-drop" : ""}`} data-state={state}>
      <img src={src} alt={alt} className={isBlank ? "doa-mark-blank" : undefined} />
    </span>
  );
}


/** Ukuran & pergeseran logo sesuai pengaturan admin. */
function logoStyle(l: DoaLogo): CSSProperties {
  return {
    height: `${l.height}px`,
    maxHeight: `${l.height}px`,
    transform: `translate(${l.x}px, ${l.y}px)`,
  };
}

type Draft = Record<string, { qris: string; kehadiran: string }>;

function SectionScreen({
  section,
  dates,
  today,
  draft,
  jabatanOf,
  onChangeQris,
  onChangeKehadiran,
  onCommit,
  inputIndexOf,
  registerInput,
  focusNext,
  logos,
  committed,
  animKey,
  options,
  activeIdx,
  onFocusRow,
}: {
  activeIdx: number;
  onFocusRow: (idx: number) => void;
  section: DoaPagiSection;
  committed: Draft;
  animKey: string | null;
  options: KehadiranOption[];
  logos: DoaLogoSettings;
  dates: string[];
  today: string;
  draft: Draft;
  jabatanOf: (nama: string) => string;
  onChangeQris: (pekerja: string, value: string) => void;
  onChangeKehadiran: (pekerja: string, value: string) => void;
  onCommit: (pekerja: string) => void;
  inputIndexOf: (sectionId: string, row: number) => number;
  registerInput: (idx: number, el: HTMLInputElement | null) => void;
  focusNext: (idx: number) => void;
}) {
  // Bagian dengan satu pekerja (mis. Pemimpin Cabang) ditampilkan selebar
  // bagian lain, namun dengan tinggi baris lebih besar karena ruang luas.
  const isLeader = /pemimpin\s+cabang/i.test(section.nama);
  const solo = section.pekerja.length === 1;
  return (
    <section className="doa-screen">
      <header className="doa-head">
        <img
          src={logos.bo.url ?? logoBo}
          alt="Branch Office Pringsewu"
          className="doa-head-logo"
          style={logoStyle(logos.bo)}
        />
        <h2 className="doa-title">
          {isLeader ? section.nama.toUpperCase() : `BAGIAN ${section.nama.toUpperCase()}`}
        </h2>
        <div className="doa-head-right">
          <img
            src={logos.danantara.url ?? logoDanantara}
            alt="Danantara Indonesia"
            className="doa-head-brand"
            style={logoStyle(logos.danantara)}
          />
          <img
            src={logos.bri.url ?? logoBri}
            alt="Bank Rakyat Indonesia"
            className="doa-head-brand"
            style={logoStyle(logos.bri)}
          />
        </div>
      </header>

      {section.deskripsi || section.keterangan ? (
        <p className="doa-note">
          {section.deskripsi}
          {section.deskripsi && section.keterangan ? " — " : ""}
          {section.keterangan}
        </p>
      ) : null}

      <div className={`doa-body${solo ? " doa-body-solo" : ""}`}>
        <div className={`doa-row doa-row-head${solo ? " doa-row-solo" : ""}`}>
          <span className="doa-col-label">Nama Pekerja</span>
          <span className="doa-col-label">Jabatan</span>
          <div className="doa-days">
            {weekdayLabels.map((d, i) => (
              <span key={i} className="doa-day-chip" title={weekdayNames[i]}>
                {d}
              </span>
            ))}
          </div>
          <span className="doa-col-label">Absen Qris</span>
          <span className="doa-col-label">Kehadiran</span>
        </div>

        {section.pekerja.length ? (
          <>
          {/* Ruang kosong atas agar baris pertama tepat di tengah layar. */}
          {solo ? null : <div className="doa-spacer" aria-hidden />}
          {section.pekerja.map((nama, row) => {
            const key = recordKey(section.id, nama, today);
            const cell = draft[key] ?? { qris: "", kehadiran: "" };
            const idx = inputIndexOf(section.id, row);
            const dist = Math.min(Math.abs(idx - activeIdx), 3);
            return (
              <div
                key={nama}
                className={`doa-row${solo ? " doa-row-solo" : " doa-row-zoom"}`}
                data-dist={solo ? undefined : dist}
                data-active={!solo && idx === activeIdx ? "true" : undefined}
              >
                <div className="doa-pill doa-name">{nama}</div>
                <div className="doa-pill doa-jabatan">{jabatanOf(nama)}</div>

                <div className="doa-days">
                  {dates.map((d) => {
                    const markKey = recordKey(section.id, nama, d);
                    const rec = committed[markKey];
                    // Silang hanya bila QRIS diisi "Kosong" secara eksplisit.
                    // Hari lampau tanpa data dibiarkan polos, hari ini/mendatang bulat putih.
                    const state = isQrisFilled(rec?.qris)
                      ? "ok"
                      : rec?.qris === QRIS_KOSONG
                        ? "no"
                        : !rec && d < today
                          ? "blank"
                          : "empty";
                    return <DayMark key={d} state={state} anim={animKey === markKey} />;
                  })}

                </div>
                <div className="doa-pill doa-input-wrap">
                  <input
                    ref={(el) => registerInput(idx, el)}
                    value={cell.qris}
                    list="doa-qris-list"
                    
                    onChange={(e) => onChangeQris(nama, e.target.value)}
                    onFocus={() => onFocusRow(idx)}
                    onBlur={() => {
                      if (cell.qris.trim()) onCommit(nama);
                    }}

                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      onCommit(nama);
                      focusNext(idx);
                    }}
                    className="doa-input"
                  />
                </div>
                <div className="doa-pill">
                  <select
                    value={cell.kehadiran}
                    onChange={(e) => onChangeKehadiran(nama, e.target.value)}
                    className="doa-select"
                  >
                    <option value=""></option>
                    {/* Nilai tersimpan yang belum ada di daftar tetap bisa tampil. */}
                    {cell.kehadiran &&
                    !options.some((o) => o.label === cell.kehadiran) ? (
                      <option value={cell.kehadiran}>{cell.kehadiran}</option>
                    ) : null}
                    {options.map((o) => (
                      <option key={o.label} value={o.label}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
          {/* Ruang kosong bawah agar baris terakhir tetap bisa ke tengah. */}
          {solo ? null : <div className="doa-spacer doa-spacer-end" aria-hidden />}
          </>
        ) : (
          <p className="doa-empty">
            Belum ada pekerja pada bagian ini. Atur di Setting → Absensi Doa Pagi.
          </p>
        )}
      </div>
    </section>
  );
}

/** Popup konfirmasi setelah admin menekan Enter di baris absen terakhir. */
function SaveDialog({
  ukerNama,
  tanggal,
  pending,
  onYes,
  onNo,
}: {
  ukerNama: string;
  tanggal: string;
  pending: boolean;
  onYes: () => void;
  onNo: () => void;
}) {
  const yesRef = useRef<HTMLButtonElement>(null);

  // Fokus otomatis ke tombol Yes agar Enter langsung menyimpan.
  useEffect(() => {
    const t = window.setTimeout(() => yesRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter") {
        e.preventDefault();
        if (!pending) onYes();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onNo();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [pending, onYes, onNo]);

  return (
    <div className="doa-modal-backdrop">
      <div className="doa-modal">
        <p className="doa-modal-title">Simpan Absensi</p>
        <p className="doa-modal-sub">
          {ukerNama} {tanggal}
        </p>
        <div className="doa-modal-actions">
          <button
            ref={yesRef}
            type="button"
            className="doa-save-btn"
            onClick={onYes}
            disabled={pending}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Yes
          </button>
          <button type="button" className="doa-save-btn doa-btn-ghost" onClick={onNo}>
            No
          </button>
        </div>
      </div>
    </div>
  );
}

/** Tanggal ISO menjadi teks panjang bahasa Indonesia. */
function longDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Layar pembuka absensi: tekan Enter untuk mulai. */
function OpeningScreen({
  logoUrl,
  ukerNama,
  tanggal,
  onStart,
}: {
  logoUrl: string;
  ukerNama: string;
  tanggal: string;
  onStart: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Enter") return;
      e.preventDefault();
      onStart();
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onStart]);

  return (
    <div className="doa-done">
      <div className="doa-done-inner">
        <img src={logoUrl} alt="Branch Office Pringsewu" className="doa-done-logo" />
        <hr className="doa-done-rule" />
        <h1 className="doa-done-title">Absensi, Doa & Briefing Pagi</h1>
        <p className="doa-done-sub">
          Selamat pagi. Siapkan absensi doa & briefing pagi untuk hari ini.
        </p>
        <div className="doa-done-meta">
          <span className="doa-done-chip">{ukerNama}</span>
          <span className="doa-done-chip">{tanggal}</span>
        </div>
        <button type="button" className="doa-enter-pill" onClick={onStart}>
          <span className="doa-enter-key">Enter</span>
          <span className="doa-enter-text">tekan Enter untuk mulai absensi</span>
        </button>
      </div>
    </div>
  );
}


function Page() {
  const [uker, setUker] = useState<{ id: string; nama: string } | null>(null);
  const dates = useMemo(() => workWeekDates(), []);
  const today = useMemo(() => {
    const iso = toIsoDate(new Date());
    return dates.includes(iso) ? iso : dates[dates.length - 1]!;
  }, [dates]);

  const board = useQuery({
    queryKey: ["doa-pagi", "board", uker?.id, today],
    enabled: !!uker,
    queryFn: () => getDoaPagiBoard({ data: { ukerId: uker!.id, dates } }),
  });

  const logoQuery = useQuery({
    queryKey: ["doa-pagi", "logos"],
    queryFn: () => getDoaPagiLogos(),
  });
  const logos: DoaLogoSettings = logoQuery.data?.logos ?? defaultDoaLogos;

  const optionQuery = useQuery({
    queryKey: ["doa-pagi", "kehadiran-options"],
    queryFn: () => getDoaPagiKehadiranOptions(),
  });
  const options: KehadiranOption[] = optionQuery.data?.options ?? defaultKehadiranOptions;


  const [draft, setDraft] = useState<Draft>({});
  // Penanda harian (ceklis/silang) hanya memakai data yang sudah dikunci Enter.
  const [committed, setCommitted] = useState<Draft>({});
  const [animKey, setAnimKey] = useState<string | null>(null);
  const [term, setTerm] = useState("");
  const [askSave, setAskSave] = useState(false);
  const [locked, setLocked] = useState(false);
  // Opening screen: absensi baru dibuka setelah admin menekan Enter.
  const [started, setStarted] = useState(false);
  // Baris yang sedang disorot (zoom) pada layar absensi.
  const [activeIdx, setActiveIdx] = useState(0);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  /** Saat absensi dimulai, sorot & fokuskan baris pertama di tengah layar. */
  useEffect(() => {
    if (!started) return;
    const t = window.setTimeout(() => {
      setActiveIdx(0);
      const first = inputs.current[0];
      if (!first) return;
      first.focus();
      first.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 300);
    return () => window.clearTimeout(t);
  }, [started]);


  const rotationQuery = useQuery({
    queryKey: ["doa-pagi", "rotasi"],
    queryFn: () => getDoaPagiRotation(),
  });

  /** Urutan bagian mengikuti rotasi harian: mulai dari bagian pilihan admin. */
  const sections: DoaPagiSection[] = useMemo(() => {
    const sorted = (board.data?.sections ?? []).slice().sort((a, b) => a.urutan - b.urutan);
    const days = uker ? rotationQuery.data?.rotation?.[uker.id] : undefined;
    const start = days?.[weekdayIndex(today)] ?? 1;
    return rotateSections(sorted, start);
  }, [board.data, rotationQuery.data, uker, today]);

  /** Jabatan pekerja (dari master pegawai unit kerja). */
  const jabatanOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of board.data?.employees ?? []) map.set(e.nama, e.jabatan);
    return (nama: string) => map.get(nama) ?? "-";
  }, [board.data]);

  /** Kunci hanya berlaku dalam sesi ini; status selesai sebenarnya dibaca dari database. */
  const lockKey = uker ? `doa-pagi-lock|${uker.id}|${today}` : null;
  useEffect(() => {
    if (lockKey) window.localStorage.removeItem(lockKey);
    setLocked(false);
  }, [lockKey]);


  useEffect(() => {
    if (!board.data) return;
    const next: Draft = {};
    for (const r of board.data.records as DoaPagiRecord[]) {
      next[recordKey(r.sectionId, r.pekerja, r.tanggal)] = {
        qris: r.qris,
        kehadiran: r.kehadiran,
      };
    }
    for (const s of board.data.sections as DoaPagiSection[])
      for (const p of s.pekerja) {
        const k = recordKey(s.id, p, today);
        if (!next[k]) next[k] = { qris: "", kehadiran: "" };
      }
    setDraft(next);
    setCommitted(next);
  }, [board.data, today]);

  const save = useMutation({
    mutationFn: (v: { sectionId: string; pekerja: string; qris: string; kehadiran: string }) =>
      saveDoaPagiRecord({ data: { ...v, tanggal: today } }),
  });

  /** Simpan seluruh absensi hari ini ke database. */
  const saveAll = useMutation({
    mutationFn: () => {
      const rows = sections.flatMap((s) =>
        s.pekerja.map((p) => {
          const cur = draft[recordKey(s.id, p, today)] ?? { qris: "", kehadiran: "" };
          return {
            sectionId: s.id,
            pekerja: p,
            tanggal: today,
            qris: cur.qris.trim(),
            kehadiran: cur.kehadiran,
          };
        }),
      );
      return saveDoaPagiRecords({ data: { rows } });
    },
    onSuccess: (r) => {
      toast.success(`Absensi tersimpan (${r.saved} baris).`);
      // Bersihkan tampilan lalu kunci absensi untuk hari ini.
      setDraft({});
      setCommitted({});
      setAskSave(false);
      setLocked(true);
      void board.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const suggest = useQuery({
    queryKey: ["doa-pagi", "qris", term],
    enabled: term.trim().length >= 2,
    queryFn: () => searchDoaPagiQris({ data: { term } }),
  });

  /** Urutan fokus input QRIS: baris per bagian, lanjut ke bagian berikutnya. */
  const offsets = useMemo(() => {
    const map: Record<string, number> = {};
    const owner: string[] = [];
    let n = 0;
    for (const s of sections) {
      map[s.id] = n;
      for (let i = 0; i < s.pekerja.length; i++) owner.push(s.id);
      n += s.pekerja.length;
    }
    return { map, owner, total: n };
  }, [sections]);

  function updateCell(
    sectionId: string,
    pekerja: string,
    patch: Partial<{ qris: string; kehadiran: string }>,
  ) {
    setDraft((d) => {
      const k = recordKey(sectionId, pekerja, today);
      const cur = d[k] ?? { qris: "", kehadiran: "" };
      return { ...d, [k]: { ...cur, ...patch } };
    });
  }

  /** Rapikan ketikan manual: setiap kata diawali huruf kapital. */
  function titleCase(s: string) {
    return s
      .trim()
      .replace(/\s+/g, " ")
      .replace(
        /\S+/g,
        (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
      );
  }

  function commit(sectionId: string, pekerja: string) {
    const k = recordKey(sectionId, pekerja, today);
    const cur = draft[k] ?? { qris: "", kehadiran: "" };
    const code = matchKehadiran(cur.qris, options);
    // Enter pada kolom QRIS kosong: tandai "Kosong" + "Hadir" (bulatan silang).
    const value = !cur.qris.trim()
      ? { qris: QRIS_KOSONG, kehadiran: "Hadir" }
      : code
        ? { qris: QRIS_KOSONG, kehadiran: code }
        : {
            qris: titleCase(cur.qris),
            // Ada absen QRIS -> kehadiran selalu "Hadir".
            kehadiran: isQrisFilled(cur.qris) ? "Hadir" : cur.kehadiran,
          };
    updateCell(sectionId, pekerja, value);

    const k2 = recordKey(sectionId, pekerja, today);
    setCommitted((c) => ({ ...c, [k2]: value }));
    setAnimKey(k2);
    window.setTimeout(() => setAnimKey((a) => (a === k2 ? null : a)), 900);
    save.mutate({ sectionId, pekerja, ...value });
  }

  if (!uker)
    return (
      <UkerDialog
        onPick={(u) => {
          setStarted(false);
          setUker(u);
        }}
      />
    );


  // Absensi hari ini dianggap selesai bila seluruh pekerja sudah punya data tersimpan.
  const filledToday = new Set(
    ((board.data?.records as DoaPagiRecord[] | undefined) ?? [])
      .filter((r) => r.tanggal === today && (r.qris.trim() !== "" || r.kehadiran.trim() !== ""))
      .map((r) => recordKey(r.sectionId, r.pekerja, r.tanggal)),
  );
  const totalPekerja = sections.reduce((n, s) => n + s.pekerja.length, 0);
  const allFilled =
    totalPekerja > 0 &&
    sections.every((s) => s.pekerja.every((p) => filledToday.has(recordKey(s.id, p, today))));
  const savedToday = locked || (!board.isLoading && allFilled);

  // Belum selesai: tampilkan opening screen dulu, lanjut ke absensi setelah Enter.
  if (!savedToday && !started)
    return (
      <div className="doa-root">
        <button
          type="button"
          onClick={() => setUker(null)}
          className="doa-close"
          aria-label="Ganti unit kerja"
        >
          <X className="size-5" />
        </button>
        <OpeningScreen
          logoUrl={logos.bo.url ?? logoBo}
          ukerNama={uker.nama}
          tanggal={longDate(today)}
          onStart={() => setStarted(true)}
        />
      </div>
    );

  if (savedToday) {
    const tanggalPanjang = longDate(today);
    return (

      <div className="doa-root">
        <button
          type="button"
          onClick={() => setUker(null)}
          className="doa-close"
          aria-label="Ganti unit kerja"
        >
          <X className="size-5" />
        </button>
        <div className="doa-done">
          <div className="doa-done-inner">
            <img
              src={logos.bo.url ?? logoBo}
              alt="Branch Office Pringsewu"
              className="doa-done-logo"
            />
            <hr className="doa-done-rule" />
            <h1 className="doa-done-title">Absensi Selesai</h1>
            <p className="doa-done-sub">
              Absensi, doa & briefing pagi hari ini telah selesai dan tersimpan.
            </p>
            <div className="doa-done-meta">
              <span className="doa-done-chip">{uker.nama}</span>
              <span className="doa-done-chip">{tanggalPanjang}</span>
            </div>
            <Link
              to="/admin"
              className="doa-done-dashboard inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold"
            >
              <LayoutDashboard className="size-4" />
              Kembali ke Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }





  return (
    <div className="doa-root">
      <datalist id="doa-qris-list">
        {(suggest.data ?? []).map((m) => (
          <option key={m.storeId} value={m.nama} />
        ))}
      </datalist>

      <button type="button" onClick={() => setUker(null)} className="doa-close" aria-label="Ganti unit kerja">
        <X className="size-5" />
      </button>

      {board.isLoading ? (
        <div className="doa-screen items-center justify-center">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Memuat bagian {uker.nama}…
          </p>
        </div>
      ) : sections.length ? (
        sections.map((s) => (
          <SectionScreen
            logos={logos}
            committed={committed}
            animKey={animKey}
            options={options}
            key={s.id}
            section={s}
            dates={dates}
            today={today}
            draft={draft}
            jabatanOf={jabatanOf}
            onChangeQris={(p, v) => {
              updateCell(s.id, p, { qris: v });
              setTerm(v);
            }}
            onChangeKehadiran={(p, v) => {
              updateCell(s.id, p, { kehadiran: v });
              const cur = draft[recordKey(s.id, p, today)];
              save.mutate({ sectionId: s.id, pekerja: p, qris: cur?.qris ?? "", kehadiran: v });
            }}
            onCommit={(p) => commit(s.id, p)}
            inputIndexOf={(sid, row) => (offsets.map[sid] ?? 0) + row}
            registerInput={(idx, el) => {
              inputs.current[idx] = el;
            }}
            activeIdx={activeIdx}
            onFocusRow={setActiveIdx}
            focusNext={(idx) => {
              const next = inputs.current[idx + 1];
              if (!next) {
                // Baris terakhir: tampilkan konfirmasi simpan absensi.
                window.setTimeout(() => setAskSave(true), 1200);
                return;
              }
              const sameSection = offsets.owner[idx] === offsets.owner[idx + 1];
              const go = () => {
                next.focus();
                next.select();
                // Hanya isi bagian yang bergulir; header bagian tetap diam.
                next.scrollIntoView({ block: "center", behavior: "smooth" });
              };
              if (sameSection) {
                go();
                return;
              }
              // Jeda agar baris terakhir bagian ini sempat terlihat dulu.
              window.setTimeout(() => {
                next.closest(".doa-screen")?.scrollIntoView({
                  block: "start",
                  behavior: "smooth",
                });
                window.setTimeout(go, 500);
              }, 1200);
            }}
          />
        ))
      ) : (
        <div className="doa-screen items-center justify-center">
          <p className="text-center text-sm text-muted-foreground">
            Belum ada bagian untuk {uker.nama}. Tambahkan di Setting → Absensi Doa Pagi.
          </p>
        </div>
      )}

      {askSave ? (
        <SaveDialog
          ukerNama={uker.nama}
          tanggal={today}
          pending={saveAll.isPending}
          onYes={() => saveAll.mutate()}
          onNo={() => setAskSave(false)}
        />
      ) : null}
    </div>
  );
}
