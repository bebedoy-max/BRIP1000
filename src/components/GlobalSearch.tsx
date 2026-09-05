import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Filter, Loader2, Search, X } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useRoles } from "@/lib/roles";
import {
  guessTitle,
  searchModules,
  
  type SearchModule,
} from "@/lib/search-registry";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmployeeProfileLink } from "@/components/EmployeeProfileLink";
import { UkerProfileLink } from "@/components/UkerProfileLink";
import { MachineProfileLink } from "@/components/MachineProfileLink";
import { RecordDetailDialog } from "@/components/RecordDetailDialog";

const db = supabase as unknown as SupabaseClient;

type Row = Record<string, unknown>;

type Hit = {
  id: string;
  title: string;
  subtitle: string;
};

type Group = {
  module: SearchModule;
  hits: Hit[];
  total: number;
};

function useDebounced(value: string, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/**
 * Pencarian dilakukan di server (ilike) supaya cepat: hanya baris yang cocok
 * yang dikirim ke browser. Yang di-cache hanyalah daftar kolom tiap tabel.
 */
const columnCache = new Map<string, Promise<{ text: string[]; numeric: string[] }>>();

const SKIP = /^(id|created_at|updated_at|.*_id|.*_url|qr_token|password.*)$/;

function loadColumns(table: string) {
  const cached = columnCache.get(table);
  if (cached) return cached;
  const p = (async () => {
    const { data } = await db.from(table).select("*").limit(1);
    const row = ((data ?? [])[0] ?? {}) as Row;
    const text: string[] = [];
    const numeric: string[] = [];
    for (const [k, v] of Object.entries(row)) {
      if (SKIP.test(k)) continue;
      if (typeof v === "string") text.push(k);
      else if (typeof v === "number") numeric.push(k);
    }
    return { text, numeric };
  })();
  columnCache.set(table, p);
  return p;
}

/** Bersihkan karakter yang merusak sintaks filter PostgREST. */
const clean = (term: string) => term.replace(/[,().*%\\]/g, " ").trim();

/** Cari id relasi (mis. uker/jabatan) — hasilnya di-cache per kata. */
const refCache = new Map<string, Promise<string[]>>();

function loadRefIds(table: string, labelColumns: string[], term: string) {
  const key = `${table}|${labelColumns.join(",")}|${term}`;
  const cached = refCache.get(key);
  if (cached) return cached;
  const p = (async () => {
    const { data } = await db
      .from(table)
      .select("id")
      .or(labelColumns.map((c) => `${c}.ilike.%${term}%`).join(","))
      .limit(50);
    return ((data ?? []) as Row[]).map((r) => String(r["id"]));
  })();
  refCache.set(key, p);
  return p;
}

async function searchModule(m: SearchModule, terms: string[]): Promise<Group> {
  const cols = await loadColumns(m.table);
  const searchable = Array.from(new Set([...(m.columns ?? []), ...cols.text]));
  if (searchable.length === 0) return { module: m, hits: [], total: 0 };

  // Filter per kata: kolom teks (ilike) + kolom angka (eq) + id hasil relasi.
  // Semua pencarian relasi dijalankan serentak agar tidak menumpuk waktu tunggu.
  const filters = await Promise.all(
    terms.map(async (raw) => {
      const term = clean(raw);
      if (!term) return "";
      const parts = searchable.map((c) => `${c}.ilike.%${term}%`);
      if (/^\d+$/.test(term)) parts.push(...cols.numeric.map((c) => `${c}.eq.${term}`));
      const refIds = await Promise.all(
        (m.refs ?? []).map(async (ref) => ({
          ref,
          ids: await loadRefIds(ref.table, ref.labelColumns, term),
        })),
      );
      for (const { ref, ids } of refIds)
        if (ids.length) parts.push(`${ref.column}.in.(${ids.join(",")})`);
      return parts.join(",");
    }),
  );
  const active = filters.filter(Boolean);
  if (active.length === 0) return { module: m, hits: [], total: 0 };

  // count "planned" memakai perkiraan perencana query: jauh lebih murah
  // daripada menghitung seluruh baris yang cocok.
  let query = db.from(m.table).select("*", { count: "planned" }).limit(5);
  for (const f of active) query = query.or(f);
  const { data, count, error } = await query;
  if (error) return { module: m, hits: [], total: 0 };

  const rows = (data ?? []) as Row[];
  return {
    module: m,
    total: count ?? rows.length,
    hits: rows.map((row) => ({
      id: String(row["id"]),
      title: (m.title ? m.title(row) : guessTitle(row)) || guessTitle(row),
      subtitle: m.subtitle?.(row) ?? "",
    })),
  };
}


/**
 * Satu baris hasil pencarian. Bila tabelnya punya label entitas yang bisa
 * diklik (pekerja, unit kerja, mesin ATM/CRM), pop up khusus entitas itu yang
 * dipakai; tabel lain memakai pop up detail generik yang isinya mengikuti
 * kolom data sehingga otomatis menyesuaikan data/menu baru.
 */
function HitRow({
  group,
  hit,
  onOpenMenu,
}: {
  group: Group;
  hit: Hit;
  onOpenMenu: () => void;
}) {
  const [open, setOpen] = useState(false);
  const table = group.module.table;

  const entityTrigger =
    table === "employees" ? (
      <EmployeeProfileLink employeeId={hit.id} nama={hit.title} />
    ) : table === "ukers" ? (
      <UkerProfileLink ukerId={hit.id} nama={hit.title} />
    ) : table === "atm_machines" || table === "crm_machines" ? (
      <MachineProfileLink
        machineId={hit.id}
        lokasi={hit.title}
        jenis={table === "crm_machines" ? "CRM" : "ATM"}
      />
    ) : null;

  return (
    <div className="group/hit flex items-start justify-between gap-2 rounded-xl px-3 py-2 transition-colors hover:bg-secondary/60">
      <div className="min-w-0 flex-1">
        {entityTrigger ?? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="truncate text-left text-sm font-medium text-primary underline-offset-4 hover:underline"
            aria-label={`Lihat detail ${hit.title}`}
          >
            {hit.title}
          </button>
        )}
        {hit.subtitle ? (
          <p className="truncate text-xs text-muted-foreground">{hit.subtitle}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label={`Buka di menu ${group.module.label}`}
        title={`Buka di menu ${group.module.label}`}
        className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        <ExternalLink className="size-3.5" />
      </button>

      {entityTrigger ? null : (
        <RecordDetailDialog
          open={open}
          onOpenChange={setOpen}
          table={table}
          id={hit.id}
          title={hit.title}
          label={group.module.label}
          refs={group.module.refs}
        />
      )}
    </div>
  );
}

export function GlobalSearch({ className = "" }: { className?: string }) {
  const navigate = useNavigate();
  const { isItAdmin, isEventAdmin, isSuperadmin } = useRoles();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const term = useDebounced(q.trim());

  const allowed = useMemo(
    () =>
      searchModules.filter((m) =>
        m.need === "it"
          ? isItAdmin
          : m.need === "event"
            ? isEventAdmin
            : m.need === "super"
              ? isSuperadmin
              : true,
      ),
    [isItAdmin, isEventAdmin, isSuperadmin],
  );

  const results = useQuery({
    queryKey: ["global-search", term, allowed.map((m) => m.route).join(",")],
    enabled: term.length >= 2,
    staleTime: 60_000,
    gcTime: 300_000,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const terms = term.toLowerCase().split(/\s+/).filter(Boolean);
      const groups = await Promise.all(allowed.map((m) => searchModule(m, terms)));
      return groups.filter((g) => g.hits.length > 0).sort((a, b) => b.total - a.total);
    },
  });


  const groups = results.data ?? [];
  const totalHits = groups.reduce((n, g) => n + g.total, 0);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      // Dialog hasil pencarian dirender melalui portal di luar boxRef. Selama
      // dialog masih aktif, jangan unmount hasil pencarian yang memilikinya.
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function goToRow(g: Group, hit: Hit) {
    setOpen(false);
    setQ("");
    void navigate({ to: g.module.route, search: { q: term, focus: hit.id } });
  }

  function goToFilter(g: Group) {
    setOpen(false);
    setQ("");
    void navigate({ to: g.module.route, search: { q: term } });
  }

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={q}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "Enter" && groups[0]) goToFilter(groups[0]);
        }}
        placeholder="Cari data di seluruh aplikasi…"
        aria-label="Pencarian global"
        className="w-full pl-9"
      />
      {q ? (
        <Button
          size="icon"
          variant="ghost"
          aria-label="Bersihkan pencarian"
          className="absolute top-1/2 right-1 size-7 -translate-y-1/2"
          onClick={() => {
            setQ("");
            setOpen(false);
          }}
        >
          <X className="size-4" />
        </Button>
      ) : null}

      {open && term.length >= 2 ? (
        <div className="glass-card absolute right-0 z-50 mt-2 max-h-[28rem] w-full min-w-[22rem] overflow-y-auto p-2">
          {results.isFetching ? (
            <p className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Mencari…
            </p>
          ) : groups.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              Tidak ada hasil untuk “{term}”.
            </p>
          ) : (
            <>
              <p className="px-3 py-2 text-xs text-muted-foreground">
                {totalHits} hasil di {groups.length} menu
              </p>
              {groups.map((g) => (
                <div key={g.module.route} className="mb-1">
                  <div className="flex items-center justify-between gap-2 px-3 py-1">
                    <span className="text-[10px] tracking-wide text-muted-foreground uppercase">
                      {g.module.label} · {g.total}
                    </span>
                    <button
                      type="button"
                      onClick={() => goToFilter(g)}
                      className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-primary hover:bg-secondary"
                    >
                      <Filter className="size-3" />
                      Filter {g.total} data di menu ini
                    </button>
                  </div>
                  {g.hits.map((h) => (
                    <HitRow
                      key={`${g.module.route}-${h.id}`}
                      group={g}
                      hit={h}
                      onOpenMenu={() => goToRow(g, h)}
                    />
                  ))}
                  {g.total > g.hits.length ? (
                    <button
                      type="button"
                      onClick={() => goToFilter(g)}
                      className="w-full rounded-xl px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-secondary/60"
                    >
                      +{g.total - g.hits.length} data lain di {g.module.label}
                    </button>
                  ) : null}
                </div>
              ))}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
