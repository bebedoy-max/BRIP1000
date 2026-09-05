/**
 * Konfigurasi project Supabase yang dipakai aplikasi.
 *
 * Kredensial diambil dari secret store Lovable (di-inject sebagai env var):
 *   VITE_SUPABASE_URL              (client + server)
 *   VITE_SUPABASE_PUBLISHABLE_KEY  (client + server, anon/publishable)
 *   SUPABASE_SERVICE_ROLE_KEY      (server-only, jangan dibocorkan ke client)
 *
 * PENTING: service_role / secret key TIDAK BOLEH ada di frontend.
 */
type RuntimeConfig = { url?: string | undefined; key?: string | undefined };

function runtimeConfig(): RuntimeConfig {
  if (typeof window !== "undefined") {
    return (window as unknown as { __SUPABASE_CONFIG__?: RuntimeConfig }).__SUPABASE_CONFIG__ ?? {};
  }
  if (typeof process !== "undefined" && process.env) {
    return {
      url: process.env['VITE_SUPABASE_URL'] || process.env['CUSTOM_SUPABASE_URL'],
      key:
        process.env['VITE_SUPABASE_PUBLISHABLE_KEY'] ||
        process.env['CUSTOM_SUPABASE_PUBLISHABLE_KEY'],
    };
  }
  return {};
}

export const CUSTOM_SUPABASE_URL =
  import.meta.env['VITE_SUPABASE_URL'] ||
  import.meta.env['VITE_SUPABASE_URL_OVERRIDE'] ||
  runtimeConfig().url ||
  "";

export const CUSTOM_SUPABASE_PUBLISHABLE_KEY =
  import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] ||
  import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY_OVERRIDE'] ||
  runtimeConfig().key ||
  "";

export type SupabaseConnection = { url: string; key: string };

export function getCustomConnection(): SupabaseConnection | null {
  if (CUSTOM_SUPABASE_URL && CUSTOM_SUPABASE_PUBLISHABLE_KEY)
    return { url: CUSTOM_SUPABASE_URL, key: CUSTOM_SUPABASE_PUBLISHABLE_KEY };
  return null;
}
