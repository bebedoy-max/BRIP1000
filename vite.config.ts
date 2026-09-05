// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Inject the custom Supabase credentials (stored as Lovable secrets) into the
// client bundle at build time. Only the URL and publishable/anon key are
// exposed — SERVICE_ROLE stays server-only.
const CUSTOM_SUPABASE_URL = process.env['CUSTOM_SUPABASE_URL'] ?? '';
const CUSTOM_SUPABASE_PUBLISHABLE_KEY = process.env['CUSTOM_SUPABASE_PUBLISHABLE_KEY'] ?? '';

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(CUSTOM_SUPABASE_URL),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(CUSTOM_SUPABASE_PUBLISHABLE_KEY),
    },
  },
});
