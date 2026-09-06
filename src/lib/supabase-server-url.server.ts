// URL Supabase untuk SEMUA koneksi sisi server (bukan browser).
// Prioritas: SUPABASE_URL (baru, untuk mengalihkan ke alamat internal VPS)
// lalu SUPABASE_INTERNAL_URL (hostname internal Docker), terakhir
// CUSTOM_SUPABASE_URL seperti sebelumnya. Browser tetap memakai
// VITE_SUPABASE_URL / CUSTOM_SUPABASE_URL lewat src/supabase-config.ts.
import { CUSTOM_SUPABASE_URL as FALLBACK_SUPABASE_URL } from "@/supabase-config";

export function getSupabaseServerUrl(): string {
  const url =
    process.env["SUPABASE_URL"] ||
    process.env["SUPABASE_INTERNAL_URL"] ||
    process.env["CUSTOM_SUPABASE_URL"] ||
    FALLBACK_SUPABASE_URL;
  if (!url) {
    throw new Error(
      "Missing Supabase environment variable(s): SUPABASE_URL or CUSTOM_SUPABASE_URL",
    );
  }
  return url;
}
