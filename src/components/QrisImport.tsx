import { useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ConfirmDialog";
import { supabase } from "@/lib/supabase";

const db = supabase as unknown as SupabaseClient;

/** Baris hasil pembacaan file Excel/CSV merchant QRIS. */
type MerchantRow = {
  store_id: string;
  nama_merchant: string;
  alamat: string | null;
  brdesc: string | null;
  merchant_type: string | null;
  status_qris: string | null;
};

/** Ambil nilai kolom apa pun ejaan headernya (spasi/underscore/besar-kecil). */
function pick(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    for (const key of Object.keys(row)) {
      if (key.replace(/[\s_]+/g, "").toLowerCase() === k.replace(/[\s_]+/g, "").toLowerCase()) {
        const v = row[key];
        if (v !== null && v !== undefined && String(v).trim() !== "") return String(v).trim();
      }
    }
  }
  return "";
}

export function QrisImport({ canWrite }: { canWrite: boolean }) {
  const qc = useQueryClient();
  const confirmDialog = useConfirm();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");

  if (!canWrite) return null;

  async function handleFile(file: File) {
    setBusy(true);
    setProgress("Membaca file…");
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]!];
      if (!sheet) throw new Error("Sheet pertama tidak ditemukan.");
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

      const seen = new Set<string>();
      const rows: MerchantRow[] = [];
      for (const r of raw) {
        const storeId = pick(r, "STOREID", "STORE ID", "store_id");
        const nama = pick(r, "NAMA_MERCHANT", "NAMA MERCHANT", "nama_merchant");
        if (!storeId || !nama || seen.has(storeId)) continue;
        seen.add(storeId);
        rows.push({
          store_id: storeId,
          nama_merchant: nama,
          alamat: pick(r, "ALAMAT") || null,
          brdesc: pick(r, "BRDESC", "UNIT KERJA") || null,
          merchant_type: pick(r, "MERCHANT_TYPE", "MERCHANT TYPE", "TIPE") || null,
          status_qris: pick(r, "STATUS QRIS", "STATUS_QRIS", "STATUS") || null,
        });
      }
      if (!rows.length) throw new Error("Tidak ada baris valid pada file.");

      const size = 500;
      for (let i = 0; i < rows.length; i += size) {
        setProgress(`Mengunggah ${Math.min(i + size, rows.length)} / ${rows.length} baris…`);
        const { error } = await db
          .from("qris_merchants")
          .upsert(rows.slice(i, i + size), { onConflict: "store_id" });
        if (error) throw new Error(error.message);
      }
      toast.success(`${rows.length} merchant QRIS berhasil diunggah.`);
      void qc.invalidateQueries({ queryKey: ["qris_merchants"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengunggah file.");
    } finally {
      setBusy(false);
      setProgress("");
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleClear() {
    const ok = await confirmDialog({
      title: "Hapus semua data merchant QRIS?",
      description: "Seluruh data merchant QRIS akan dihapus permanen dan tidak bisa dikembalikan.",
      confirmText: "Hapus Semua",
      destructive: true,

    });
    if (!ok) return;
    setBusy(true);
    try {
      const { error } = await db.from("qris_merchants").delete().not("store_id", "is", null);
      if (error) throw new Error(error.message);
      toast.success("Semua data merchant QRIS dihapus.");
      void qc.invalidateQueries({ queryKey: ["qris_merchants"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus data.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass-card mb-4 flex flex-wrap items-center gap-3 p-4">
      <div className="mr-auto">
        <p className="text-sm font-semibold">Upload Data Merchant QRIS</p>
        <p className="text-xs text-muted-foreground">
          File .xlsx / .csv dengan kolom STORE ID, NAMA_MERCHANT, ALAMAT, UNIT KERJA, MERCHANT_TYPE,
          STATUS QRIS. Store ID yang sama akan diperbarui.
        </p>
        {progress ? <p className="mt-1 text-xs text-muted-foreground">{progress}</p> : null}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
      <Button type="button" disabled={busy} onClick={() => fileRef.current?.click()}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        Upload File
      </Button>
      <Button type="button" variant="destructive" disabled={busy} onClick={() => void handleClear()}>
        <Trash2 className="size-4" /> Hapus Semua
      </Button>
    </div>
  );
}
