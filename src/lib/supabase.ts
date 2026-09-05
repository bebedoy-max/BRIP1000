import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabase as defaultClient } from "@/integrations/supabase/client";
import { getCustomConnection } from "@/supabase-config";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

function build(url: string, key: string): Client {
  return createClient<Database>(url, key, {
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (
          (key.startsWith("sb_publishable_") || key.startsWith("sb_secret_")) &&
          headers.get("Authorization") === `Bearer ${key}`
        ) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
    auth: {
      storage: typeof window !== "undefined" ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
      // Penukaran kode OAuth ditangani manual di /auth agar error terlihat.
      detectSessionInUrl: false,
      flowType: "pkce",
    },
  });
}

let cached: { url: string; client: Client } | undefined;

function resolve(): Client {
  const custom = getCustomConnection();
  if (!custom) return defaultClient as unknown as Client;
  if (cached?.url !== custom.url) cached = { url: custom.url, client: build(custom.url, custom.key) };
  return cached.client;
}

/**
 * Klien database aplikasi. Otomatis memakai project Supabase milik Anda bila
 * sudah dikonfigurasi (src/supabase-config.ts / env Vercel),
 * jika belum akan memakai backend bawaan.
 */
export const supabase = new Proxy({} as Client, {
  get(_, prop, receiver) {
    return Reflect.get(resolve(), prop, receiver);
  },
});