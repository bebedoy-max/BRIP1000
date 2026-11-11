import { createFileRoute } from "@tanstack/react-router";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });
}

export const Route = createFileRoute("/api/public/companion/drive-status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Status akun Drive (email, folder) hanya untuk admin yang login.
        try {
          const { authorizeCompanion } = await import("@/lib/companion-auth.server");
          await authorizeCompanion(request);
        } catch (e) {
          const msg = (e as Error).message;
          return json({ connected: false, error: msg }, msg === "Unauthorized" ? 401 : 403);
        }
        try {
          const { getActiveAccount } = await import("@/lib/drive.server");
          const acc = await getActiveAccount();
          return json({
            connected: true,
            label: acc.label,
            email: acc.account_email,
            rootFolder: acc.root_folder_name,
          });
        } catch (e) {
          return json({ connected: false, error: (e as Error).message });
        }
      },
    },
  },
});
