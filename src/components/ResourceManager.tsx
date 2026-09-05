import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { PageEditContext } from "@/components/AdminLayout";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { Plus, Pencil, Trash2, Search, Images } from "lucide-react";
import { toast } from "sonner";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";


// Dynamic table names need an untyped client.
const db = supabase as unknown as SupabaseClient;
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { DatePickerField } from "@/components/DatePickerField";
import { useConfirm } from "@/components/ConfirmDialog";
import { MapsLink } from "@/components/MapsLink";
import { UkerProfileLink } from "@/components/UkerProfileLink";
import { EmployeeProfileLink } from "@/components/EmployeeProfileLink";
import { MachineProfileLink } from "@/components/MachineProfileLink";
import { PhotoGallery } from "@/components/PhotoGallery";
import type { PhotoEntity } from "@/lib/drive-entities";

/** Normalisasi nilai dari DB ke format date picker. */
function toPickerValue(raw: unknown, withTime: boolean) {
  if (raw === null || raw === undefined || raw === "") return "";
  const s = String(raw);
  if (!withTime) return s.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return s.slice(0, 16);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export type FieldType =
  | "text"
  | "number"
  | "date"
  | "datetime"
  | "textarea"
  | "boolean"
  | "select"
  | "uker"
  | "ref"
  | "reftext"
  | "digits"
  | "ip"
  | "latlng";



/** Hanya angka. */
export function formatDigits(v: string) {
  return v.replace(/\D/g, "");
}

/** Auto format IP: user ketik angka → 013.156.017.001 */
export function formatIp(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 12);
  return (d.match(/.{1,3}/g) ?? []).join(".");
}

export function isValidIp(v: string) {
  const parts = v.split(".");
  if (parts.length !== 4) return false;
  return parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255);
}

/** "latitude, longitude" */
export function isValidLatLng(v: string) {
  const m = v.split(",").map((s) => s.trim());
  if (m.length !== 2) return false;
  const lat = Number(m[0]);
  const lng = Number(m[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (!/^-?\d+(\.\d+)?$/.test(m[0]!) || !/^-?\d+(\.\d+)?$/.test(m[1]!)) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export type Field = {
  key: string;
  label: string;
  type?: FieldType;
  options?: string[];
  /** Opsi select dengan value & label berbeda. */
  optionItems?: { value: string; label: string }[];
  required?: boolean;
  hideInTable?: boolean;
  hideInForm?: boolean;
  /** Untuk type "digits": jumlah digit wajib. */
  digitsLength?: number;
  /** Untuk type "ref": tabel sumber pilihan. */
  refTable?: string;
  /** Kolom teks yang dipakai sebagai label pilihan. */
  refLabelColumn?: string;
  /**
   * Untuk type "reftext": kolom teks tempat menyimpan nama bebas
   * ketika pengguna tidak ada di tabel relasi.
   */
  textColumn?: string;
  /**
   * Isi otomatis field ini dari baris relasi field lain.
   * Contoh: uker_id diisi dari employees.uker_id saat memilih pengguna.
   */
  autoFill?: { fromField: string; column: string };
  /** Placeholder khusus. */
  placeholder?: string;
  /** Nilai wajib unik pada tabel (dicek sebelum simpan). */
  unique?: boolean;
};

/** Input teks manual + saran otomatis dari tabel relasi. */
function RefTextField({
  id,
  options,
  labelColumn,
  text,
  matchedId,
  onPick,
  onText,
  placeholder,
}: {
  id: string;
  options: Row[];
  labelColumn: string;
  text: string;
  matchedId: string;
  onPick: (row: Row) => void;
  onText: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const term = text.trim().toLowerCase();
  const suggestions = useMemo(() => {
    if (!term) return options.slice(0, 8);
    return options
      .filter((o) => String(o[labelColumn] ?? "").toLowerCase().includes(term))
      .slice(0, 8);
  }, [options, labelColumn, term]);

  return (
    <div className="relative">
      <Input
        id={id}
        autoComplete="off"
        value={text}
        placeholder={placeholder ?? "Ketik nama…"}
        onChange={(e) => {
          onText(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
      />
      {open && suggestions.length > 0 ? (
        <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-input bg-popover py-1 shadow-lg">
          {suggestions.map((o) => (
            <li key={String(o["id"])}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-secondary/60"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(o);
                  setOpen(false);
                }}
              >
                {String(o[labelColumn] ?? "")}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-xs text-muted-foreground">
        {matchedId
          ? "Terhubung ke data pekerja."
          : text.trim()
            ? "Nama manual (tidak ada di data pekerja)."
            : "Ketik untuk mencari di data pekerja, atau isi manual."}
      </p>
    </div>
  );
}



type Row = Record<string, unknown>;

export type ResourceManagerProps = {
  table: string;
  title: string;
  description?: string;
  fields: Field[];
  orderBy?: string;
  canWrite?: boolean;
  /** Column set to the current user id on insert (e.g. uploaded_by, created_by). */
  ownerColumn?: string;
  /** Bila diisi, tiap data punya galeri foto Google Drive. */
  photoEntity?: PhotoEntity;
  extraActions?: (row: Row) => React.ReactNode;
  /** Kolom tambahan sebelum kolom aksi, mis. status index wajah. */
  extraColumn?: { label: string; render: (row: Row) => React.ReactNode };
  /**
   * Bila diisi, data diambil per halaman langsung dari database (cocok untuk
   * tabel puluhan ribu baris) dan pencarian dilakukan di sisi server.
   */
  pageSize?: number;
};


function emptyForm(fields: Field[]): Row {
  const out: Row = {};
  for (const f of fields) {
    if (f.hideInForm) continue;
    out[f.key] = f.type === "boolean" ? true : "";
    if (f.type === "reftext" && f.textColumn) out[f.textColumn] = "";
  }
  return out;
}


export function ResourceManager({
  table,
  title,
  description,
  fields,
  orderBy = "created_at",
  canWrite,
  ownerColumn,
  photoEntity,
  extraActions,
  extraColumn,
  pageSize,
}: ResourceManagerProps) {
  const confirmDialog = useConfirm();
  const mayEdit = useContext(PageEditContext);
  canWrite = (canWrite ?? true) && mayEdit;
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [photoRow, setPhotoRow] = useState<Row | null>(null);
  const [form, setForm] = useState<Row>(() => emptyForm(fields));
  const urlSearch = useSearch({ strict: false }) as { q?: string; focus?: string };
  const [q, setQ] = useState(urlSearch.q ?? "");
  const [page, setPage] = useState(0);
  const focusId = urlSearch.focus;
  const focusRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    if (urlSearch.q !== undefined) setQ(urlSearch.q);
  }, [urlSearch.q]);

  /** Kata kunci pencarian server-side ditunda agar tidak query tiap ketikan. */
  const [debouncedQ, setDebouncedQ] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setPage(0), [debouncedQ]);

  const needsUkers = fields.some((f) => f.type === "uker");

  /** Kolom teks biasa yang bisa dicari langsung di database. */
  const searchColumns = useMemo(
    () =>
      fields
        .filter(
          (f) =>
            !f.type ||
            f.type === "text" ||
            f.type === "textarea" ||
            f.type === "digits" ||
            f.type === "select",
        )
        .map((f) => f.key),
    [fields],
  );

  const paged = typeof pageSize === "number" && pageSize > 0;

  const list = useQuery({
    queryKey: paged ? [table, orderBy, "page", page, pageSize, debouncedQ] : [table, orderBy],
    queryFn: async () => {
      if (paged) {
        const term = debouncedQ.trim();
        let query = db.from(table).select("*", { count: "exact" });
        if (term && searchColumns.length) {
          const esc = term.replace(/[%,()]/g, " ").trim();
          query = query.or(searchColumns.map((c) => `${c}.ilike.%${esc}%`).join(","));
        }
        const from = page * pageSize!;
        const { data, error, count } = await query
          .order(orderBy, { ascending: false })
          .range(from, from + pageSize! - 1);
        if (error) throw error;
        return { rows: (data ?? []) as Row[], count: count ?? 0 };
      }
      const { data, error } = await db
        .from(table)
        .select("*")
        .order(orderBy, { ascending: false });
      if (error) throw error;
      return { rows: (data ?? []) as Row[], count: (data ?? []).length };
    },
    placeholderData: (prev) => prev,
  });


  const ukers = useQuery({
    queryKey: ["ukers-options"],
    enabled: needsUkers,
    queryFn: async () => {
      const { data, error } = await db
        .from("ukers")
        .select("id, kode_uker, nama_uker")
        .order("kode_uker");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const refFields = useMemo(
    () => fields.filter((f) => (f.type === "ref" || f.type === "reftext") && f.refTable),
    [fields],
  );


  /** Field yang terisi otomatis dari relasi field lain. */
  const autoFillFields = useMemo(
    () => fields.filter((f) => f.autoFill),
    [fields],
  );

  const refs = useQuery({
    queryKey: [
      "ref-options",
      refFields.map((f) => `${f.refTable}:${f.refLabelColumn}`).join(","),
      autoFillFields.map((f) => `${f.autoFill!.fromField}.${f.autoFill!.column}`).join(","),
    ],
    enabled: refFields.length > 0,
    queryFn: async () => {
      const out: Record<string, Row[]> = {};
      for (const f of refFields) {
        const col = f.refLabelColumn ?? "nama";
        const extras = autoFillFields
          .filter((a) => a.autoFill!.fromField === f.key)
          .map((a) => a.autoFill!.column)
          .filter((c) => c !== col && c !== "id");
        const select = ["id", col, ...new Set(extras)].join(", ");
        const { data, error } = await db.from(f.refTable!).select(select).order(col);
        if (error) throw error;
        out[f.key] = (data ?? []) as unknown as Row[];
      }
      return out;
    },
  });

  const ukerLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of ukers.data ?? [])
      m.set(String(u["id"]), `${String(u["kode_uker"])} — ${String(u["nama_uker"])}`);
    return m;
  }, [ukers.data]);

  const save = useMutation({
    mutationFn: async (payload: Row) => {
      const body: Row = {};
      for (const f of fields) {
        if (f.hideInForm) continue;
        if (f.type === "reftext") {
          const label = String(payload[f.textColumn ?? ""] ?? "").trim();
          const opts = refs.data?.[f.key] ?? [];
          const matched = opts.find(
            (o) =>
              String(o[f.refLabelColumn ?? "nama"] ?? "").trim().toLowerCase() ===
              label.toLowerCase(),
          );
          if (!label) {
            if (f.required) throw new Error(`${f.label} wajib diisi`);
            body[f.key] = null;
            if (f.textColumn) body[f.textColumn] = null;
          } else {
            body[f.key] = matched ? String(matched["id"]) : null;
            if (f.textColumn) body[f.textColumn] = label;
          }

          continue;
        }
        const v = payload[f.key];
        const str = typeof v === "string" ? v.trim() : v;
        if (f.type === "boolean") body[f.key] = Boolean(v);

        else if (str === "" || str === undefined || str === null) {
          if (f.required) throw new Error(`${f.label} wajib diisi`);
          body[f.key] = null;
        } else if (f.type === "digits") {
          if (!/^\d+$/.test(String(str))) throw new Error(`${f.label} harus berupa angka saja`);
          if (f.digitsLength && String(str).length !== f.digitsLength)
            throw new Error(`${f.label} harus ${f.digitsLength} digit angka`);
          body[f.key] = String(str);

        } else if (f.type === "ip") {
          if (!isValidIp(String(str)))
            throw new Error(`${f.label} harus format IP valid, contoh 013.156.017.001`);
          body[f.key] = String(str);
        } else if (f.type === "latlng") {
          if (!isValidLatLng(String(str)))
            throw new Error(`${f.label} harus format "latitude, longitude" yang valid`);
          body[f.key] = String(str);
        } else if (f.type === "number") body[f.key] = Number(str);
        else body[f.key] = str;
      }
      // Cegah data duplikat pada kolom unik (Personal Number, TID, Kode Uker, dst.)
      for (const f of fields) {
        if (!f.unique) continue;
        const val = body[f.key];
        if (val === null || val === undefined || val === "") continue;
        let q = db.from(table).select("id", { count: "exact", head: true }).eq(f.key, val);
        if (editing) q = q.neq("id", editing["id"] as string);
        const { count, error: dupErr } = await q;
        if (dupErr) throw dupErr;
        if ((count ?? 0) > 0) throw new Error(`${f.label} "${val}" sudah terdaftar`);
      }
      if (editing) {
        const { error } = await db.from(table).update(body).eq("id", editing["id"] as string);
        if (error) throw error;
      } else {
        if (ownerColumn) {
          const { data: auth } = await db.auth.getUser();
          body[ownerColumn] = auth.user?.id ?? null;
        }
        const { error } = await db.from(table).insert(body);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Data diperbarui" : "Data ditambahkan");
      setOpen(false);
      setEditing(null);
      void qc.invalidateQueries({ queryKey: [table] });
    },
    onError: (e: Error) =>
      toast.error(
        /duplicate key|already exists|unique/i.test(e.message)
          ? "Data duplikat: nilai tersebut sudah terdaftar"
          : e.message,
      ),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Data dihapus");
      void qc.invalidateQueries({ queryKey: [table] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const tableFields = fields.filter((f) => !f.hideInTable);
  const formFields = fields.filter((f) => !f.hideInForm);
  const totalCols = tableFields.length + 1 + (extraColumn ? 1 : 0);

  /** Teks yang tampil di sel — dipakai juga sebagai bahan pencarian. */
  function cellText(f: Field, row: Row): string {
    const v = row[f.key];
    if (f.type === "boolean") return v ? "Aktif" : "Nonaktif";
    if (f.type === "uker") return ukerLabel.get(v as string) ?? "";
    if (f.type === "select" && f.optionItems)
      return f.optionItems.find((o) => o.value === String(v))?.label ?? "";
    if (f.type === "ref") {
      const opt = (refs.data?.[f.key] ?? []).find((o) => String(o["id"]) === String(v));
      return opt ? String(opt[f.refLabelColumn ?? "nama"] ?? "") : "";
    }
    if (f.type === "reftext") {
      const opt = (refs.data?.[f.key] ?? []).find((o) => String(o["id"]) === String(v));
      if (opt) return String(opt[f.refLabelColumn ?? "nama"] ?? "");
      const raw = f.textColumn ? row[f.textColumn] : null;
      return raw == null ? "" : String(raw);
    }

    if (v === null || v === undefined || v === "") return "";
    if (f.type === "datetime") return new Date(String(v)).toLocaleString("id-ID");
    if (f.type === "date") return `${String(v)} ${new Date(String(v)).toLocaleDateString("id-ID")}`;
    return String(v);
  }

  /** Semua kolom (termasuk relasi & kolom mentah) jadi satu haystack. */
  function rowHaystack(row: Row): string {
    const parts = fields.map((f) => cellText(f, row));
    for (const [k, v] of Object.entries(row)) {
      if (v === null || v === undefined) continue;
      if (typeof v === "object") continue;
      if (k === "id" || k.endsWith("_id")) continue;
      parts.push(String(v));
    }
    return parts.join(" ").toLowerCase();
  }

  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const allRows: Row[] = list.data?.rows ?? [];
  const totalCount = list.data?.count ?? allRows.length;
  const rows = paged
    ? allRows
    : allRows.filter((r) => {
        if (terms.length === 0) return true;
        const hay = rowHaystack(r);
        return terms.every((t) => hay.includes(t));
      });
  const pageCount = paged ? Math.max(1, Math.ceil(totalCount / pageSize!)) : 1;


  useEffect(() => {
    if (focusId && focusRef.current) {
      focusRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [focusId, list.data]);

  /** Nama entitas (uker/atm/edc/dst) untuk label "Foto <nama>" pada popup maps. */
  function rowLabel(row: Row): string | undefined {
    const pick = fields.find((f) =>
      /nama|lokasi|merchant|judul|title/i.test(f.key),
    );
    if (pick) {
      const t = cellText(pick, row).trim();
      if (t) return t;
    }
    const firstText = fields.find(
      (f) =>
        !["id", "created_at", "updated_at"].includes(f.key) &&
        !f.key.endsWith("_id") &&
        f.type !== "boolean" &&
        f.type !== "latlng",
    );
    if (firstText) {
      const t = cellText(firstText, row).trim();
      if (t) return t;
    }
    return undefined;
  }

  function renderCell(f: Field, row: Row) {
    const v = row[f.key];
    if (table === "ukers" && f.key === "nama_uker")
      return (
        <UkerProfileLink
          ukerId={String(row["id"] ?? "")}
          nama={String(v ?? "—")}
          kode={row["kode_uker"] ? String(row["kode_uker"]) : undefined}
          tipe={row["tipe"] as string | null}
          deskripsi={row["deskripsi"] as string | null}
        />
      );
    if (table === "employees" && f.key === "nama")
      return <EmployeeProfileLink employeeId={String(row["id"] ?? "")} nama={String(v ?? "—")} />;
    if ((table === "atm_machines" || table === "crm_machines") && f.key === "lokasi")
      return (
        <MachineProfileLink
          machineId={String(row["id"] ?? "")}
          lokasi={String(v ?? "—")}
          jenis={table === "crm_machines" ? "CRM" : "ATM"}
        />
      );
    if (f.type === "boolean")
      return <Badge variant={v ? "default" : "secondary"}>{v ? "Aktif" : "Nonaktif"}</Badge>;
    if (f.type === "uker") return ukerLabel.get(v as string) ?? "—";
    if (f.type === "select" && f.optionItems)
      return f.optionItems.find((o) => o.value === String(v))?.label ?? "—";
    if (f.type === "ref") {
      const opt = (refs.data?.[f.key] ?? []).find((o) => String(o["id"]) === String(v));
      return opt ? String(opt[f.refLabelColumn ?? "nama"] ?? "—") : "—";
    }
    if (f.type === "reftext") return cellText(f, row) || "—";


    if (v === null || v === undefined || v === "") return "—";
    if (f.type === "latlng")
      return (
        <MapsLink
          value={v}
          name={rowLabel(row)}
          photoEntity={photoEntity}
          entityId={String(row["id"] ?? "")}
        />
      );
    if (f.type === "datetime") return new Date(String(v)).toLocaleString("id-ID");
    return String(v);
  }


  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari / filter semua kolom…"
              aria-label={`Cari di ${title}`}
              className="w-64 pl-9"
            />
          </div>

          {canWrite ? (
            <Button
              onClick={() => {
                setEditing(null);
                setForm(emptyForm(fields));
                setOpen(true);
              }}
            >
              <Plus className="size-4" /> Tambah
            </Button>
          ) : null}
        </div>
      </div>

      <div className="glass-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-xs tracking-wide text-muted-foreground uppercase">
              {tableFields.map((f, i) => (
                <th
                  key={f.key}
                  className={`px-4 py-3 font-medium whitespace-nowrap ${i > 1 ? "hidden md:table-cell" : ""}`}
                >
                  {f.label}
                </th>
              ))}
              {extraColumn ? (
                <th className="px-4 py-3 font-medium whitespace-nowrap">{extraColumn.label}</th>
              ) : null}
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {list.isLoading ? (
              <tr>
                <td colSpan={totalCols} className="px-4 py-8 text-center text-muted-foreground">
                  Memuat data…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={totalCols} className="px-4 py-8 text-center text-muted-foreground">
                  Belum ada data.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={String(row["id"])}
                  ref={String(row["id"]) === focusId ? focusRef : undefined}
                  className={`border-b border-border/40 last:border-0 hover:bg-secondary/40 ${
                    String(row["id"]) === focusId ? "bg-primary/15 ring-1 ring-primary/40" : ""
                  }`}
                >

                  {tableFields.map((f, i) => (
                    <td
                      key={f.key}
                      className={`px-4 py-3 whitespace-nowrap ${i > 1 ? "hidden md:table-cell" : ""}`}
                    >
                      {renderCell(f, row)}
                    </td>
                  ))}
                  {extraColumn ? (
                    <td className="px-4 py-3 whitespace-nowrap">{extraColumn.render(row)}</td>
                  ) : null}
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      {extraActions?.(row)}
                      {photoEntity ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Galeri foto"
                          onClick={() => setPhotoRow(row)}
                        >
                          <Images className="size-4" />
                        </Button>
                      ) : null}
                      {canWrite ? (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setEditing(row);
                              const next: Row = {};
                              for (const f of formFields) {
                                next[f.key] = row[f.key] ?? "";
                                if (f.type === "reftext" && f.textColumn)
                                  next[f.textColumn] = cellText(f, row);
                              }
                              setForm(next);

                              setOpen(true);
                            }}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              void confirmDialog({
                                title: "Hapus data ini?",
                                description: "Data yang dihapus tidak dapat dikembalikan.",
                                confirmText: "Hapus",
                                destructive: true,
                              }).then((ok) => {
                                if (ok) remove.mutate(String(row["id"]));
                              });
                            }}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {paged ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-muted-foreground">
            {totalCount === 0
              ? "Tidak ada data"
              : `Menampilkan ${page * pageSize! + 1}–${Math.min((page + 1) * pageSize!, totalCount)} dari ${totalCount.toLocaleString("id-ID")} data`}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0 || list.isFetching}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Sebelumnya
            </Button>
            <span className="text-muted-foreground">
              Halaman {page + 1} / {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 >= pageCount || list.isFetching}
              onClick={() => setPage((p) => p + 1)}
            >
              Berikutnya
            </Button>
          </div>
        </div>
      ) : null}



      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? `Ubah ${title}` : `Tambah ${title}`}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            {formFields.map((f) => (
              <div key={f.key} className="grid gap-2">
                <Label htmlFor={f.key}>
                  {f.label}
                  {f.required ? <span className="ml-1 text-destructive">*</span> : null}
                </Label>
                {f.type === "textarea" ? (
                  <Textarea
                    id={f.key}
                    value={String(form[f.key] ?? "")}
                    placeholder={f.placeholder}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  />
                ) : f.type === "boolean" ? (
                  <Switch
                    id={f.key}
                    checked={Boolean(form[f.key])}
                    onCheckedChange={(v) => setForm({ ...form, [f.key]: v })}
                  />
                ) : f.type === "select" ? (
                  <select
                    id={f.key}
                    className="h-10 rounded-xl border border-input bg-popover px-3 text-sm"
                    value={String(form[f.key] ?? "")}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  >
                    <option value="">— pilih —</option>
                    {(f.optionItems ?? (f.options ?? []).map((o) => ({ value: o, label: o }))).map(
                      (o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ),
                    )}
                  </select>
                ) : f.type === "uker" ? (
                  <select
                    id={f.key}
                    className="h-10 rounded-xl border border-input bg-popover px-3 text-sm"
                    value={String(form[f.key] ?? "")}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  >
                    <option value="">— pilih unit kerja —</option>
                    {(ukers.data ?? []).map((u) => (
                      <option key={String(u["id"])} value={String(u["id"])}>
                        {String(u["kode_uker"])} — {String(u["nama_uker"])}
                      </option>
                    ))}
                  </select>
                ) : f.type === "ref" ? (
                  <select
                    id={f.key}
                    className="h-10 rounded-xl border border-input bg-popover px-3 text-sm"
                    value={String(form[f.key] ?? "")}
                    onChange={(e) => {
                      const value = e.target.value;
                      const next: Row = { ...form, [f.key]: value };
                      for (const a of autoFillFields) {
                        if (a.autoFill!.fromField !== f.key) continue;
                        const src = (refs.data?.[f.key] ?? []).find(
                          (o) => String(o["id"]) === value,
                        );
                        const filled = src?.[a.autoFill!.column];
                        next[a.key] = filled == null ? "" : String(filled);
                      }
                      setForm(next);
                    }}
                  >
                    <option value="">— pilih —</option>
                    {(refs.data?.[f.key] ?? []).map((o) => (
                      <option key={String(o["id"])} value={String(o["id"])}>
                        {String(o[f.refLabelColumn ?? "nama"] ?? "")}
                      </option>
                    ))}
                  </select>
                ) : f.type === "reftext" ? (
                  <RefTextField
                    id={f.key}
                    options={refs.data?.[f.key] ?? []}
                    labelColumn={f.refLabelColumn ?? "nama"}
                    text={String(form[f.textColumn ?? ""] ?? "")}
                    matchedId={String(form[f.key] ?? "")}
                    {...(f.placeholder ? { placeholder: f.placeholder } : {})}
                    onText={(v) =>
                      setForm({ ...form, [f.textColumn ?? "_text"]: v, [f.key]: "" })
                    }
                    onPick={(o) => {
                      const next: Row = {
                        ...form,
                        [f.key]: String(o["id"]),
                        [f.textColumn ?? "_text"]: String(o[f.refLabelColumn ?? "nama"] ?? ""),
                      };
                      for (const a of autoFillFields) {
                        if (a.autoFill!.fromField !== f.key) continue;
                        const filled = o[a.autoFill!.column];
                        next[a.key] = filled == null ? "" : String(filled);
                      }
                      setForm(next);
                    }}
                  />

                ) : f.type === "date" || f.type === "datetime" ? (
                  <DatePickerField
                    id={f.key}
                    withTime={f.type === "datetime"}
                    {...(f.placeholder ? { placeholder: f.placeholder } : {})}
                    value={toPickerValue(form[f.key], f.type === "datetime")}
                    onChange={(v: string) => setForm({ ...form, [f.key]: v })}
                  />
                ) : (

                  <Input
                    id={f.key}
                    type={f.type === "number" ? "number" : "text"}

                    value={String(form[f.key] ?? "")}

                    inputMode={f.type === "ip" || f.type === "digits" ? "numeric" : undefined}
                    maxLength={
                      f.type === "digits" && f.digitsLength ? f.digitsLength : undefined
                    }
                    placeholder={
                      f.placeholder ??
                      (f.type === "ip"
                        ? "013.156.017.001"
                        : f.type === "latlng"
                          ? "-5.358000, 104.975000"
                          : undefined)
                    }
                    onChange={(e) => {
                      const raw = e.target.value;
                      const next =
                        f.type === "ip"
                          ? formatIp(raw)
                          : f.type === "digits"
                            ? formatDigits(raw).slice(0, f.digitsLength ?? 32)
                            : raw;

                      setForm({ ...form, [f.key]: next });
                    }}
                  />
                )}
              </div>
            ))}
            {photoEntity ? (
              editing ? (
                <div className="border-t border-border/60 pt-4">
                  <PhotoGallery
                    entity={photoEntity}
                    entityId={String(editing["id"] ?? "")}
                    canEdit={!!canWrite}
                    title="Galeri Foto"
                  />
                </div>
              ) : (
                <p className="border-t border-border/60 pt-4 text-xs text-muted-foreground">
                  Simpan data terlebih dahulu untuk menambahkan foto.
                </p>
              )
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button disabled={save.isPending} onClick={() => save.mutate(form)}>
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {photoEntity ? (
        <Dialog open={!!photoRow} onOpenChange={(v) => !v && setPhotoRow(null)}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Galeri Foto — {title}</DialogTitle>
            </DialogHeader>
            {photoRow ? (
              <PhotoGallery
                entity={photoEntity}
                entityId={String(photoRow["id"] ?? "")}
                canEdit={!!canWrite}
                title="Foto tersimpan di Google Drive"
              />
            ) : null}
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}