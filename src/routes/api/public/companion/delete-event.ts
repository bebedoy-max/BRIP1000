import { createFileRoute } from "@tanstack/react-router";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });
}

/**
 * Hapus folder event (beserta seluruh fotonya) di Google Drive.
 * Dipakai companion app sebelum menghapus data event di database.
 */
export const Route = createFileRoute("/api/public/companion/delete-event")({
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

        let payload: { subfolder?: string; fileIds?: string[] };
        try {
          payload = (await request.json()) as typeof payload;
        } catch {
          return json({ error: "Body JSON tidak valid" }, 400);
        }

        try {
          const drive = await import("@/lib/drive.server");
          const acc = await drive.getActiveAccount();
          const token = await drive.accessToken(acc);

          let deletedFiles = 0;
          for (const id of payload.fileIds ?? []) {
            try {
              await drive.deleteFromDrive(token, id);
              deletedFiles += 1;
            } catch {
              /* file mungkin sudah tidak ada */
            }
          }

          let folderDeleted = false;
          if (payload.subfolder) {
            const folderId = await drive.ensureEntityFolder(acc, token, "event", payload.subfolder);
            const res = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
            folderDeleted = res.ok || res.status === 404;
            if (!folderDeleted) {
              const text = await res.text();
              return json({ error: `Drive error [${res.status}]: ${text}` }, 500);
            }
          }

          return json({ ok: true, deletedFiles, folderDeleted });
        } catch (e) {
          console.error(e);
          return json({ error: (e as Error).message }, 500);
        }
      },
    },
  },
});
