import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, Loader2, Search, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAccess } from "@/lib/access";
import { generateTutorialTopic } from "@/lib/ai-brain.functions";
import {
  groupTopics,
  parseContent,
  tutorialTopics,
  useTutorials,
  type TutorialTopic,
} from "@/lib/tutorial";

/** Render isi panduan (heading, poin, langkah, paragraf). */
function ContentView({ raw }: { raw: string }) {
  const blocks = useMemo(() => parseContent(raw), [raw]);
  return (
    <div className="space-y-4 text-sm leading-relaxed text-foreground/90">
      {blocks.map((b, i) => {
        if (b.type === "heading")
          return (
            <h3 key={i} className="mt-6 text-base font-semibold text-foreground first:mt-0">
              {b.text}
            </h3>
          );
        if (b.type === "bullets")
          return (
            <ul key={i} className="ml-5 list-disc space-y-1">
              {b.items.map((it, j) => (
                <li key={j}>{it}</li>
              ))}
            </ul>
          );
        if (b.type === "steps")
          return (
            <ol key={i} className="space-y-2">
              {b.items.map((it, j) => (
                <li key={j} className="flex gap-3">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                    {j + 1}
                  </span>
                  <span>{it}</span>
                </li>
              ))}
            </ol>
          );
        return (
          <p key={i} className="text-muted-foreground">
            {b.text}
          </p>
        );
      })}
    </div>
  );
}

export function TutorialGuide() {
  const qc = useQueryClient();
  const access = useAccess();
  const isSuper = access.level === "super_admin";
  const generate = useServerFn(generateTutorialTopic);
  const { data: rows = [], isLoading } = useTutorials();

  const topics = useMemo(() => tutorialTopics(), []);
  const [q, setQ] = useState("");
  const [active, setActive] = useState<string>(topics[0]?.key ?? "umum");
  const [busy, setBusy] = useState<string | null>(null);
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);

  const byKey = useMemo(() => new Map(rows.map((r) => [r.topic_key, r])), [rows]);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return topics;
    return topics.filter((t) => {
      const row = byKey.get(t.key);
      return (
        t.label.toLowerCase().includes(s) ||
        (row?.judul ?? "").toLowerCase().includes(s) ||
        (row?.ringkasan ?? "").toLowerCase().includes(s) ||
        (row?.konten ?? "").toLowerCase().includes(s)
      );
    });
  }, [q, topics, byKey]);

  const groups = useMemo(() => groupTopics(filtered), [filtered]);
  const current = topics.find((t) => t.key === active) ?? topics[0];
  const currentRow = current ? byKey.get(current.key) : undefined;

  const konteks = useMemo(
    () =>
      `Daftar menu aplikasi: ${topics.map((t) => `${t.label} (${t.key})`).join(", ")}.`,
    [topics],
  );

  async function writeTopic(topic: TutorialTopic) {
    await generate({
      data: {
        topicKey: topic.key,
        topicLabel: topic.label,
        topicGroup: topic.group,
        konteks: topic.konteks ? `${konteks}\nTentang fitur ini: ${topic.konteks}` : konteks,
      },
    });
  }


  async function generateOne(topic: TutorialTopic) {
    setBusy(topic.key);
    try {
      await writeTopic(topic);
      await qc.invalidateQueries({ queryKey: ["tutorials"] });
      toast.success(`Panduan "${topic.label}" ditulis AI`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function generateMissing() {
    const targets = topics.filter((t) => !(byKey.get(t.key)?.konten ?? "").trim());
    if (!targets.length) {
      toast.info("Semua topik sudah terisi.");
      return;
    }
    setBulk({ done: 0, total: targets.length });
    let ok = 0;
    for (const [i, t] of targets.entries()) {
      try {
        await writeTopic(t);
        ok += 1;
      } catch (e) {
        toast.error(`${t.label}: ${(e as Error).message}`);
        break;
      }
      setBulk({ done: i + 1, total: targets.length });
    }
    setBulk(null);
    await qc.invalidateQueries({ queryKey: ["tutorials"] });
    if (ok) toast.success(`${ok} panduan ditulis AI`);
  }

  const filled = rows.filter((r) => (r.konten ?? "").trim()).length;

  return (
    <div className="space-y-4">
      <div className="glass-card flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold">Tutorial &amp; Panduan</h1>
          <p className="text-sm text-muted-foreground">
            Panduan tata cara penggunaan seluruh fitur aplikasi, ditulis otomatis oleh AI Brain.
            Daftar topik mengikuti menu yang ada, jadi menu/fitur baru otomatis muncul di sini.
          </p>
        </div>
        <Badge variant="secondary">
          {filled}/{topics.length} topik terisi
        </Badge>
        {isSuper ? (
          <Button onClick={generateMissing} disabled={!!bulk || !!busy}>
            {bulk ? (
              <>
                <Loader2 className="size-4 animate-spin" /> {bulk.done}/{bulk.total}
              </>
            ) : (
              <>
                <Wand2 className="size-4" /> Tulis semua dengan AI
              </>
            )}
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="glass-card max-h-[70vh] space-y-3 overflow-y-auto p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari panduan…"
              className="pl-9"
            />
          </div>
          {groups.map((g) => (
            <div key={g.group} className="space-y-1">
              <p className="px-2 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {g.group}
              </p>
              {g.items.map((t) => {
                const has = (byKey.get(t.key)?.konten ?? "").trim().length > 0;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setActive(t.key)}
                    className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                      active === t.key
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                    }`}
                  >
                    <t.icon className="size-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{t.label}</span>
                    {!has ? <span className="size-1.5 rounded-full bg-muted-foreground/40" /> : null}
                  </button>
                );
              })}
            </div>
          ))}
          {!groups.length ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              Topik tidak ditemukan.
            </p>
          ) : null}
        </aside>

        <section className="glass-card min-h-[50vh] p-5">
          {!current ? null : (
            <>
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold">{currentRow?.judul ?? current.label}</h2>
                  {currentRow?.ringkasan ? (
                    <p className="mt-1 text-sm text-muted-foreground">{currentRow.ringkasan}</p>
                  ) : null}
                </div>
                {isSuper ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy === current.key || !!bulk}
                    onClick={() => generateOne(current)}
                  >
                    {busy === current.key ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Sparkles className="size-4" />
                    )}
                    {currentRow ? "Tulis ulang dengan AI" : "Tulis dengan AI"}
                  </Button>
                ) : null}
              </div>

              <div className="mt-5">
                {isLoading ? null : (currentRow?.konten ?? "").trim() ? (
                  <ContentView raw={currentRow!.konten!} />
                ) : (
                  <div className="flex flex-col items-center gap-2 py-12 text-center">
                    <BookOpen className="size-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Panduan untuk topik ini belum ditulis AI.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
