// Verifikasi access token Supabase (server-only).
// Utamakan verifikasi lokal dengan JWT secret (cepat, tanpa jaringan).
// Bila secret belum diisi, jatuhkan ke verifikasi via Auth API Supabase.
import { CUSTOM_SUPABASE_PUBLISHABLE_KEY as FALLBACK_KEY } from "@/supabase-config";
import { getSupabaseServerUrl } from "@/lib/supabase-server-url.server";

export async function verifySupabaseToken(
  token: string,
): Promise<Record<string, unknown>> {
  if (!token || token.split(".").length !== 3) {
    throw new Error("Unauthorized: Invalid token");
  }

  const secret =
    process.env["CUSTOM_SUPABASE_JWT_SECRET"] || process.env["SUPABASE_JWT_SECRET"];

  if (secret) {
    try {
      const { jwtVerify } = await import("jose");
      const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
        algorithms: ["HS256"],
      });
      if (!payload["sub"]) throw new Error("no sub");
      return payload as Record<string, unknown>;
    } catch {
      throw new Error("Unauthorized: Invalid token");
    }
  }

  // Fallback: tanya langsung ke Supabase Auth.
  const url = getSupabaseServerUrl();
  const key = process.env["CUSTOM_SUPABASE_PUBLISHABLE_KEY"] || FALLBACK_KEY;
  if (!url || !key) throw new Error("Unauthorized: Invalid token");

  const res = await fetch(`${url.replace(/\/$/, "")}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Unauthorized: Invalid token");
  const user = (await res.json()) as { id?: string; email?: string };
  if (!user?.id) throw new Error("Unauthorized: Invalid token");
  return { sub: user.id, email: user.email };
}
