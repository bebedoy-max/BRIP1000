import { createFileRoute } from "@tanstack/react-router";

/**
 * Mengirim installer Windows sebagai byte stream biner utuh.
 * Dilayani dari server (bukan file statis) agar CDN tidak mengubah/memotong isi ZIP.
 */
export const Route = createFileRoute("/api/public/companion/installer")({
  server: {
    handlers: {
      GET: async () => {
        const { WINDOWS_INSTALLER_BASE64, WINDOWS_INSTALLER_NAME } = await import(
          "@/lib/installer-payload.server"
        );

        const bytes = Buffer.from(WINDOWS_INSTALLER_BASE64, "base64");
        const body = new Uint8Array(bytes);

        return new Response(body, {
          headers: {
            "content-type": "application/octet-stream",
            "content-length": String(body.byteLength),
            "content-disposition": `attachment; filename="${WINDOWS_INSTALLER_NAME}"`,
            "cache-control": "no-transform, public, max-age=300",
            "accept-ranges": "none",
          },
        });
      },
    },
  },
});
