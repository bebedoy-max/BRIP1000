// Build config for self-hosted Node.js deployment (VPS / Coolify).
// Usage: bun run build:node  ->  produces .output/ with a node-server bundle,
// started with `node app.cjs`.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const CUSTOM_SUPABASE_URL = process.env['CUSTOM_SUPABASE_URL'] ?? process.env['VITE_SUPABASE_URL'] ?? '';
const CUSTOM_SUPABASE_PUBLISHABLE_KEY =
  process.env['CUSTOM_SUPABASE_PUBLISHABLE_KEY'] ?? process.env['VITE_SUPABASE_PUBLISHABLE_KEY'] ?? '';

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  // Target a plain Node.js server instead of Cloudflare Workers.
  nitro: {
    preset: "node-server",
  },
  vite: {
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(CUSTOM_SUPABASE_URL),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(CUSTOM_SUPABASE_PUBLISHABLE_KEY),
    },
  },
});
