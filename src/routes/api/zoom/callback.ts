import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/zoom/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { handleZoomCallback } = await import("@/lib/zoom-callback.server");
        return handleZoomCallback(request);
      },
    },
  },
});
