/**
 * Node.js entry point for self-hosted deployment (VPS / Coolify).
 *
 * Build first:   bun run build:node    (or: npm run build:node)
 * Then start:    node app.cjs
 *
 * Environment:
 *   PORT  - port to listen on (default 3000)
 *   HOST  - host to bind      (default 0.0.0.0)
 */
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

process.env.PORT = process.env.PORT || '3000';
process.env.HOST = process.env.HOST || '0.0.0.0';
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const serverEntry = path.join(__dirname, '.output', 'server', 'index.mjs');

if (!fs.existsSync(serverEntry)) {
  console.error(
    `[app.cjs] Build output not found at ${serverEntry}\n` +
      `Run "npm run build:node" (or "bun run build:node") before starting the server.`,
  );
  process.exit(1);
}

console.log(`[app.cjs] Starting server on http://${process.env.HOST}:${process.env.PORT}`);

import(pathToFileURL(serverEntry).href).catch((err) => {
  console.error('[app.cjs] Failed to start server:', err);
  process.exit(1);
});
