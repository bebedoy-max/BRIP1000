// Verifikasi token companion app (server-only).
import { createClient } from "@supabase/supabase-js";
import {
  CUSTOM_SUPABASE_URL as FALLBACK_URL,
  CUSTOM_SUPABASE_PUBLISHABLE_KEY as FALLBACK_KEY,
} from "@/supabase-config";

export async function authorizeCompanion(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) throw new Error("Unauthorized");
  const token = auth.slice(7);

  const url = process.env["CUSTOM_SUPABASE_URL"] || FALLBACK_URL;
  const key = process.env["CUSTOM_SUPABASE_PUBLISHABLE_KEY"] || FALLBACK_KEY;
  const supabase = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data: userRes, error } = await supabase.auth.getUser(token);
  if (error || !userRes?.user) throw new Error("Unauthorized");

  const { assertAdmin } = await import("@/lib/drive-guard.server");
  await assertAdmin(supabase, userRes.user.id);
  return { supabase, userId: userRes.user.id };
}
