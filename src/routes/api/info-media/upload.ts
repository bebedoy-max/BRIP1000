import { createFileRoute } from "@tanstack/react-router";

/**
 * Meneruskan potongan (chunk) unggahan media papan informasi ke sesi resumable
 * Google Drive. Browser mengirim ke domain aplikasi sendiri, sehingga tidak ada
 * masalah CORS ("Failed to fetch") saat mengunggah gambar/video besar.
 */
export const Route = createFileRoute("/api/info-media/upload")({
  server: {
    handlers: {
      PUT: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        try {
          const { verifySupabaseToken } = await import("@/lib/verify-token.server");
          await verifySupabaseToken(token);
        } catch {
          return new Response("Unauthorized", { status: 401 });
        }

        const uploadUrl = request.headers.get("x-upload-url");
        if (!uploadUrl || !/^https:\/\/[\w.-]*googleapis\.com\//.test(uploadUrl)) {
          return new Response("URL unggah tidak valid", { status: 400 });
        }

        const range = request.headers.get("x-content-range") ?? "";
        const headers: Record<string, string> = {};
        if (range) headers["Content-Range"] = range;
        const type = request.headers.get("x-file-type");
        if (type) headers["Content-Type"] = type;

        const body: BodyInit | null = range.startsWith("bytes */")
          ? null
          : await request.arrayBuffer();
        const res = await fetch(uploadUrl, { method: "PUT", headers, body });

        const text = await res.text();
        const out = new Headers({ "content-type": "text/plain; charset=utf-8" });
        const gRange = res.headers.get("range");
        if (gRange) out.set("x-google-range", gRange);
        return new Response(text, { status: res.status === 308 ? 208 : res.status, headers: out });
      },
    },
  },
});
