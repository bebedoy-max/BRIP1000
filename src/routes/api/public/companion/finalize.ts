import { createFileRoute } from "@tanstack/react-router";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });
}

/** Setel izin "siapa saja dengan tautan" untuk file hasil resumable upload. */
export const Route = createFileRoute("/api/public/companion/finalize")({
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

        let payload: { fileId?: string };
        try {
          payload = (await request.json()) as typeof payload;
        } catch {
          return json({ error: "Body JSON tidak valid" }, 400);
        }
        if (!payload.fileId) return json({ error: "fileId wajib diisi" }, 400);

        try {
          const drive = await import("@/lib/drive.server");
          const acc = await drive.getActiveAccount();
          const token = await drive.accessToken(acc);
          await fetch(`https://www.googleapis.com/drive/v3/files/${payload.fileId}/permissions`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
            body: JSON.stringify({ role: "reader", type: "anyone" }),
          });
          return json({
            id: payload.fileId,
            webViewLink: `https://drive.google.com/file/d/${payload.fileId}/view`,
          });
        } catch (e) {
          console.error(e);
          return json({ error: (e as Error).message }, 500);
        }
      },
    },
  },
});
