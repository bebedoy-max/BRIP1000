import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import {
  CUSTOM_SUPABASE_URL as FALLBACK_URL,
  CUSTOM_SUPABASE_PUBLISHABLE_KEY as FALLBACK_KEY,
} from "@/supabase-config";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });
}

export const Route = createFileRoute("/api/public/companion/upload")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-headers": "authorization,content-type",
            "access-control-allow-methods": "POST,OPTIONS",
          },
        }),
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
        const token = auth.slice(7);

        const url = process.env["CUSTOM_SUPABASE_URL"] || FALLBACK_URL;
        const key = process.env["CUSTOM_SUPABASE_PUBLISHABLE_KEY"] || FALLBACK_KEY;
        const supabase = createClient(url, key, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });
        const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !userRes?.user) return json({ error: "Unauthorized" }, 401);

        try {
          const { assertAdmin } = await import("@/lib/drive-guard.server");
          await assertAdmin(supabase, userRes.user.id);
        } catch (e) {
          return json({ error: (e as Error).message }, 403);
        }

        let payload: {
          subfolder?: string;
          fileName?: string;
          mimeType?: string;
          base64?: string;
        };
        try {
          payload = (await request.json()) as typeof payload;
        } catch {
          return json({ error: "Body JSON tidak valid" }, 400);
        }
        if (!payload.base64 || !payload.fileName) return json({ error: "File tidak lengkap" }, 400);
        if (payload.base64.length > 40_000_000) return json({ error: "File terlalu besar" }, 400);

        try {
          const drive = await import("@/lib/drive.server");
          const acc = await drive.getActiveAccount();
          const accessToken = await drive.accessToken(acc);
          const folderId = await drive.ensureEntityFolder(
            acc,
            accessToken,
            "event",
            payload.subfolder,
          );
          const binary = atob(payload.base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const file = await drive.uploadToDrive({
            token: accessToken,
            folderId,
            name: payload.fileName,
            mimeType: payload.mimeType || "image/jpeg",
            bytes,
          });
          return json({
            id: file.id,
            name: file.name,
            folderId,
            webViewLink: file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`,
          });
        } catch (e) {
          console.error(e);
          return json({ error: (e as Error).message }, 500);
        }
      },
    },
  },
});
