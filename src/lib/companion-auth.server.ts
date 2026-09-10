// Verifikasi token companion app (server-only).
import { createClient } from "@supabase/supabase-js";
import { CUSTOM_SUPABASE_PUBLISHABLE_KEY as FALLBACK_KEY } from "@/supabase-config";
import { getSupabaseServerUrl } from "@/lib/supabase-server-url.server";

export async function authorizeCompanion(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) throw new Error("Unauthorized");
  const token = auth.slice(7);
  if (!token) throw new Error("Unauthorized");

  const { verifySupabaseToken } = await import("@/lib/verify-token.server");
  let claims: Record<string, unknown>;
  try {
    claims = await verifySupabaseToken(token);
  } catch {
    throw new Error("Unauthorized");
  }

  if (!claims["sub"]) throw new Error("Unauthorized");
  const userId = claims["sub"] as string;

  const url = getSupabaseServerUrl();
  const key = process.env["CUSTOM_SUPABASE_PUBLISHABLE_KEY"] || FALLBACK_KEY;
  const supabase = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  const { assertAdmin } = await import("@/lib/drive-guard.server");
  await assertAdmin(supabase, userId);
  return { supabase, userId };
}
