import { createFileRoute } from "@tanstack/react-router";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });
}

/**
 * Membuat sesi resumable upload Google Drive.
 * Aplikasi desktop mengirim byte foto langsung ke Google (tidak lewat server),
 * sehingga tidak kena batas ukuran payload serverless (413).
 */
export const Route = createFileRoute("/api/public/companion/upload-url")({
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
        try {
          const { authorizeCompanion } = await import("@/lib/companion-auth.server");
          await authorizeCompanion(request);
        } catch (e) {
          const msg = (e as Error).message;
          return json({ error: msg }, msg === "Unauthorized" ? 401 : 403);
        }

        let payload: { subfolder?: string; fileName?: string; mimeType?: string };
        try {
          payload = (await request.json()) as typeof payload;
        } catch {
          return json({ error: "Body JSON tidak valid" }, 400);
        }
        if (!payload.fileName) return json({ error: "Nama file wajib diisi" }, 400);

        try {
          const drive = await import("@/lib/drive.server");
          const acc = await drive.getActiveAccount();
          const token = await drive.accessToken(acc);
          const folderId = await drive.ensureEntityFolder(acc, token, "event", payload.subfolder);

          const res = await fetch(
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "content-type": "application/json; charset=UTF-8",
                "X-Upload-Content-Type": payload.mimeType || "image/jpeg",
              },
              body: JSON.stringify({ name: payload.fileName, parents: [folderId] }),
            },
          );
          if (!res.ok) {
            const text = await res.text();
            return json({ error: `Drive resumable error [${res.status}]: ${text}` }, 500);
          }
          const uploadUrl = res.headers.get("location");
          if (!uploadUrl) return json({ error: "Google tidak mengirim URL upload" }, 500);
          return json({ uploadUrl, folderId });
        } catch (e) {
          console.error(e);
          return json({ error: (e as Error).message }, 500);
        }
      },
    },
  },
});
