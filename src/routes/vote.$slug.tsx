import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Lock, PauseCircle, Vote as VoteIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { voteInitials, type VoteCategory, type VoteNominee } from "@/lib/vote-ui";
import { checkVoter, getVoteEvent, submitVote } from "@/lib/vote.functions";

export const Route = createFileRoute("/vote/$slug")({
  head: () => ({
    meta: [
      { title: "Voting Pekerja — BRI BO Pringsewu" },
      {
        name: "description",
        content:
          "Halaman voting pekerja BRI Branch Office Pringsewu. Masukkan Personal Number untuk memberikan suara.",
      },
      { property: "og:title", content: "Voting Pekerja — BRI BO Pringsewu" },
      {
        property: "og:description",
        content: "Berikan suaramu untuk nominasi pekerja terbaik BRI BO Pringsewu.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

type VoterState = { pn: string; nama: string | null; votes: { category: string; nominee: string }[] };

function Page() {
  const { slug } = Route.useParams();
  const [pn, setPn] = useState("");
  const [voter, setVoter] = useState<VoterState | null>(null);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const q = useQuery({
    queryKey: ["vote-public", slug],
    queryFn: () => getVoteEvent({ data: { slug } }),
    refetchInterval: 30_000,
  });

  const settings = q.data?.settings ?? null;
  const nominees = (q.data?.nominees ?? []) as VoteNominee[];
  const categories = (settings?.categories ?? []) as VoteCategory[];
  const accent = settings?.accent ?? "#a855f7";

  const votedMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of voter?.votes ?? []) m.set(v.category, v.nominee);
    return m;
  }, [voter]);

  const closed = settings?.isClosed === true;
  const hold = settings?.isHold === true;

  async function masuk() {
    if (closed) return;
    setBusy(true);
    try {
      const res = await checkVoter({ data: { slug, pn: pn.trim() } });
      if (!res.valid) {
        toast.error(
          res.reason === "format"
            ? "Personal Number harus 6-10 digit angka."
            : res.reason === "not_found"
              ? "Personal Number tidak terdaftar pada Data Pekerja."
              : "Vote event tidak ditemukan.",
        );
      } else {
        setPicks({});
        setVoter({ pn: pn.trim(), nama: res.nama, votes: res.votes });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal memeriksa Personal Number");
    }
    setBusy(false);
  }

  function keluar() {
    setVoter(null);
    setPicks({});
    setPn("");
  }

  async function simpan() {
    if (!voter) return;
    const pending = Object.entries(picks).filter(([cat]) => !votedMap.has(cat));
    if (!pending.length) {
      toast.error("Pilih minimal satu nominasi terlebih dahulu.");
      return;
    }
    setBusy(true);
    const tersimpan: { category: string; nominee: string }[] = [];
    try {
      for (const [category, nominee] of pending) {
        const res = await submitVote({ data: { slug, pn: voter.pn, category, nominee } });
        if (res.ok) {
          tersimpan.push({ category, nominee });
        } else {
          toast.error(
            res.reason === "closed"
              ? "Voting telah ditutup."
              : res.reason === "hold"
                ? "Voting sedang dihentikan sementara."
                : res.reason === "already_voted"
                  ? `Kamu sudah memilih pada kategori ${category}.`
                  : "Suara tidak dapat disimpan.",
          );
        }
      }
      if (tersimpan.length) {
        setVoter({ ...voter, votes: [...voter.votes, ...tersimpan] });
        setPicks({});
        toast.success("Vote berhasil disimpan.");
      }
      void q.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengirim suara");
    }
    setBusy(false);
  }

  if (q.isLoading) {
    return <Shell accent={accent}><p className="text-center text-sm opacity-70">Memuat...</p></Shell>;
  }
  if (!settings) {
    return (
      <Shell accent={accent}>
        <p className="text-center text-sm opacity-80">Vote event tidak ditemukan atau sudah dihapus.</p>
      </Shell>
    );
  }

  const selesai = !!voter && categories.length > 0 && categories.every((c) => votedMap.has(c.name));
  const terpilih = categories.filter((c) => votedMap.has(c.name) || picks[c.name]).length;

  return (
    <Shell accent={accent}>
      <header className="space-y-2 text-center">
        {settings.eyebrow ? (
          <p
            className="text-xs font-semibold uppercase tracking-[0.35em]"
            style={{ color: accent }}
          >
            {settings.eyebrow}
          </p>
        ) : null}
        <h1 className="text-3xl font-extrabold sm:text-4xl">{settings.title}</h1>
        {settings.subtitle ? (
          <p className="text-lg font-semibold opacity-90">{settings.subtitle}</p>
        ) : null}
        <p className="text-sm opacity-75 sm:whitespace-nowrap">
          Masukkan Personal Number Anda. Setiap Personal Number berhak memilih satu nominasi untuk
          masing-masing kategori.
        </p>
      </header>

      {closed ? (
        <div className="rounded-2xl border border-red-400/40 bg-red-500/10 p-6 text-center">
          <Lock className="mx-auto mb-2 size-8" />
          <h2 className="text-lg font-semibold">Voting telah ditutup</h2>
          <p className="text-sm opacity-80">
            Periode voting sudah selesai. Terima kasih atas partisipasinya.
          </p>
        </div>
      ) : null}

      {!closed && hold ? (
        <div className="rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4 text-center text-sm">
          <PauseCircle className="mx-auto mb-1 size-6" />
          Voting dihentikan sementara oleh panitia. Silakan coba beberapa saat lagi.
        </div>
      ) : null}

      {!voter ? (
        <div className="mx-auto w-full max-w-sm space-y-3 rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur">
          <div>
            <Label className="text-sm">Personal Number</Label>
            <Input
              inputMode="numeric"
              placeholder="contoh: 00222254"
              value={pn}
              disabled={closed}
              onChange={(e) => setPn(e.target.value.replace(/\D/g, "").slice(0, 10))}
              className="bg-white/10"
            />
          </div>
          <Button
            className="w-full"
            style={{ background: accent }}
            disabled={busy || closed || hold || pn.trim().length < 6}
            onClick={() => void masuk()}
          >
            <VoteIcon className="size-4" />
            {closed
              ? "Voting Telah Ditutup"
              : hold
                ? "Voting Dihentikan Sementara"
                : "Masuk & Mulai Voting"}
          </Button>
          <p className="text-center text-xs opacity-70">
            Personal Number diverifikasi dengan Data Pekerja BRI BO Pringsewu.
          </p>
        </div>
      ) : selesai ? (
        <div className="mx-auto w-full max-w-md rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-8 text-center">
          <div className="mb-3 text-4xl">🎉</div>
          <h2 className="text-2xl font-bold">Terima kasih atas suara Anda!</h2>
          <p className="mt-1 text-sm opacity-80">
            Pilihan Anda sudah tersimpan dan tidak dapat diubah lagi.
          </p>
          <Button className="mt-5" variant="outline" onClick={keluar}>
            Selesai
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm">
            <span>
              Personal Number: <b>{voter.pn}</b>
            </span>
            <span className="opacity-80">
              {terpilih} / {categories.length} kategori telah dipilih
            </span>
            <Button size="sm" variant="outline" onClick={keluar}>
              Keluar
            </Button>
          </div>

          {categories.map((c) => {
            const list = nominees.filter((n) => n.category === c.name);
            const chosen = votedMap.get(c.name) ?? picks[c.name] ?? null;
            const locked = votedMap.has(c.name);
            return (
              <section key={c.name} className="space-y-3">
                <h2
                  className="flex flex-wrap items-center gap-2 text-lg font-semibold"
                  style={{ color: c.color }}
                >
                  <span
                    className="grid size-9 place-items-center rounded-xl text-base"
                    style={{ background: `${c.color}33`, boxShadow: `0 8px 24px -12px ${c.color}` }}
                  >
                    {c.icon}
                  </span>
                  {c.name}
                  {locked ? (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/80">
                      sudah memilih
                    </span>
                  ) : null}
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((n) => {
                    const active = chosen === n.nama;
                    return (
                      <div
                        key={n.id}
                        className={`rounded-2xl border p-4 transition duration-200 ${
                          active
                            ? "border-white/60 bg-white/15"
                            : "border-white/15 bg-white/5 hover:bg-white/10"
                        }`}
                        style={active ? { boxShadow: `0 0 30px -8px ${c.color}` } : undefined}
                      >
                        <div className="flex items-center gap-3">
                          {n.foto ? (
                            <img
                              src={n.foto}
                              alt={n.nama}
                              className="size-12 shrink-0 rounded-full object-cover"
                            />
                          ) : (
                            <span
                              className="grid size-12 shrink-0 place-items-center rounded-full text-sm font-bold"
                              style={{ background: c.color }}
                            >
                              {voteInitials(n.nama)}
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{n.nama}</p>
                            <p className="truncate text-xs opacity-70">
                              {[n.jabatan, n.uker].filter(Boolean).join(" • ") || "-"}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          className="mt-3 w-full"
                          variant={active ? "default" : "secondary"}
                          disabled={busy || locked || hold || closed}
                          style={active ? { background: c.color } : undefined}
                          onClick={() => setPicks((p) => ({ ...p, [c.name]: n.nama }))}
                        >
                          {active ? (
                            <>
                              <CheckCircle2 className="size-4" /> Dipilih
                            </>
                          ) : (
                            "Pilih"
                          )}
                        </Button>
                      </div>
                    );
                  })}
                  {list.length === 0 ? (
                    <p className="text-sm opacity-70">Belum ada nominasi pada kategori ini.</p>
                  ) : null}
                </div>
              </section>
            );
          })}

          <div className="space-y-2 pt-2 text-center">
            <Button
              className="mx-auto h-14 w-full max-w-md rounded-2xl text-base font-bold"
              style={{ background: "#0f7a52" }}
              disabled={busy || closed || hold || terpilih < categories.length}
              onClick={() => void simpan()}
            >
              {busy ? "Menyimpan..." : "Simpan Vote"}
            </Button>
            <p className="text-xs opacity-70" style={{ color: accent }}>
              {terpilih < categories.length
                ? `Pilih semua kategori dulu (${terpilih}/${categories.length}) untuk mengaktifkan tombol Simpan Vote.`
                : "Anda masih bisa mengganti pilihan sebelum menekan Simpan Vote."}
            </p>
          </div>

        </div>
      )}
    </Shell>
  );
}

function Shell({ accent, children }: { accent: string; children: React.ReactNode }) {
  return (
    <main
      className="vote-show min-h-screen px-4 py-10 text-white"
      style={{
        background: `radial-gradient(900px 500px at 50% -10%, ${accent}55, transparent), #0b1020`,
      }}
    >
      <div className="mx-auto w-full max-w-6xl space-y-6">{children}</div>
    </main>
  );
}
