import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Building2, Loader2, Save, X } from "lucide-react";
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
  kehadiranOptions,
  recordKey,
  shortcutFor,
  toIsoDate,
  weekdayLabels,
  weekdayNames,
  workWeekDates,
  defaultDoaLogos,
  type DoaLogo,
  type DoaLogoSettings,
  type DoaPagiRecord,
  type DoaPagiSection,
} from "@/lib/doa-pagi-ui";
import {
  getDoaPagiBoard,
  getDoaPagiLogos,
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
 * Penanda harian: kosong (bulat putih) sampai ada absen pada hari itu,
 * lalu ceklis bila QRIS terisi, silang bila hari sudah lewat tanpa QRIS.
 */
function DayMark({ state }: { state: "ok" | "no" | "empty" }) {
  const src = state === "ok" ? iconCeklis : state === "no" ? iconSilang : iconCircle;
  const alt =
    state === "ok" ? "Hadir" : state === "no" ? "Tidak absen QRIS" : "Belum ada absensi";
  return (
    <span className="doa-mark" data-state={state}>
      <img src={src} alt={alt} />
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
}: {
  section: DoaPagiSection;
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
          section.pekerja.map((nama, row) => {
            const key = recordKey(section.id, nama, today);
            const cell = draft[key] ?? { qris: "", kehadiran: "Belum Hadir" };
            const idx = inputIndexOf(section.id, row);
            return (
              <div key={nama} className={`doa-row${solo ? " doa-row-solo" : ""}`}>
                <div className="doa-pill doa-name">{nama}</div>
                <div className="doa-pill doa-jabatan">{jabatanOf(nama)}</div>

                <div className="doa-days">
                  {dates.map((d) => {
                    const rec = draft[recordKey(section.id, nama, d)];
                    // Hari ini tetap bulat putih sampai admin absen QRIS;
                    // silang hanya muncul bila QRIS diisi "Kosong" secara eksplisit.
                    const state = isQrisFilled(rec?.qris)
                      ? "ok"
                      : d < today || rec?.qris === QRIS_KOSONG
                        ? "no"
                        : "empty";
                    return <DayMark key={d} state={state} />;
                  })}

                </div>
                <div className="doa-pill doa-input-wrap">
                  <input
                    ref={(el) => registerInput(idx, el)}
                    value={cell.qris}
                    list="doa-qris-list"
                    placeholder="nama merchant qris"
                    onChange={(e) => onChangeQris(nama, e.target.value)}
                    onBlur={() => onCommit(nama)}
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
                    {kehadiranOptions.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })
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
  return (
    <div className="doa-modal-backdrop">
      <div className="doa-modal">
        <p className="doa-modal-title">Simpan Absensi</p>
        <p className="doa-modal-sub">
          {ukerNama} {tanggal}
        </p>
        <div className="doa-modal-actions">
          <button type="button" className="doa-save-btn" onClick={onYes} disabled={pending}>
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


  const [draft, setDraft] = useState<Draft>({});
  const [term, setTerm] = useState("");
  const [askSave, setAskSave] = useState(false);
  const [locked, setLocked] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const sections: DoaPagiSection[] = useMemo(
    () => (board.data?.sections ?? []).slice().sort((a, b) => a.urutan - b.urutan),
    [board.data],
  );

  /** Jabatan pekerja (dari master pegawai unit kerja). */
  const jabatanOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of board.data?.employees ?? []) map.set(e.nama, e.jabatan);
    return (nama: string) => map.get(nama) ?? "-";
  }, [board.data]);

  /** Kunci absensi harian tersimpan per unit kerja + tanggal. */
  const lockKey = uker ? `doa-pagi-lock|${uker.id}|${today}` : null;
  useEffect(() => {
    if (!lockKey) return;
    setLocked(window.localStorage.getItem(lockKey) === "1");
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
        if (!next[k]) next[k] = { qris: "", kehadiran: "Belum Hadir" };
      }
    setDraft(next);
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
          const cur = draft[recordKey(s.id, p, today)] ?? { qris: "", kehadiran: "Belum Hadir" };
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
      setAskSave(false);
      setLocked(true);
      if (lockKey) window.localStorage.setItem(lockKey, "1");
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
    let n = 0;
    for (const s of sections) {
      map[s.id] = n;
      n += s.pekerja.length;
    }
    return { map, total: n };
  }, [sections]);

  function updateCell(
    sectionId: string,
    pekerja: string,
    patch: Partial<{ qris: string; kehadiran: string }>,
  ) {
    setDraft((d) => {
      const k = recordKey(sectionId, pekerja, today);
      const cur = d[k] ?? { qris: "", kehadiran: "Belum Hadir" };
      return { ...d, [k]: { ...cur, ...patch } };
    });
  }

  function commit(sectionId: string, pekerja: string) {
    const k = recordKey(sectionId, pekerja, today);
    const cur = draft[k];
    if (!cur) return;
    const code = shortcutFor(cur.qris);
    const value = code
      ? { qris: QRIS_KOSONG, kehadiran: code }
      : {
          qris: cur.qris.trim(),
          kehadiran: isQrisFilled(cur.qris)
            ? cur.kehadiran === "Belum Hadir"
              ? "Hadir"
              : cur.kehadiran
            : cur.kehadiran,
        };
    updateCell(sectionId, pekerja, value);
    save.mutate({ sectionId, pekerja, ...value });
  }

  if (!uker) return <UkerDialog onPick={setUker} />;

  if (locked)
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
        <div className="doa-screen items-center justify-center">
          <p className="doa-modal-title text-center">Absensi Selesai</p>
          <p className="mt-2 text-center text-white/80">
            Absen hari ini {today} sudah selesai untuk {uker.nama}.
          </p>
        </div>
      </div>
    );

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
          <p className="flex items-center gap-2 text-sm text-white/80">
            <Loader2 className="size-4 animate-spin" /> Memuat bagian {uker.nama}…
          </p>
        </div>
      ) : sections.length ? (
        sections.map((s) => (
          <SectionScreen
            logos={logos}
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
            focusNext={(idx) => {
              const next = inputs.current[idx + 1];
              if (next) {
                next.focus();
                next.select();
                next.scrollIntoView({ block: "center", behavior: "smooth" });
                return;
              }
              // Baris terakhir: tampilkan konfirmasi simpan absensi.
              setAskSave(true);
            }}
          />
        ))
      ) : (
        <div className="doa-screen items-center justify-center">
          <p className="text-center text-sm text-white/80">
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
