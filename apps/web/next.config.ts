import type { NextConfig } from "next";

const standalone = process.env.NEXT_OUTPUT === "standalone";

const nextConfig: NextConfig = {
  // Next allows one `next dev` per build folder, so the end-to-end test
  // server (Playwright) builds into its own folder and can run next to yours.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // The Docker image (docker/web.Dockerfile) sets NEXT_OUTPUT=standalone:
  // the build then copies only the files the server needs into
  // .next/standalone, run with `node apps/web/server.js`. Elsewhere it stays
  // off, so `next start` (CI's e2e server) works as before.
  output: standalone ? "standalone" : undefined,
  // In Docker, Caddy compresses responses (docker/Caddyfile), so the web
  // server doesn't spend its CPU doing it too.
  compress: !standalone,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    // y-monaco 0.1.6 imports this old path, which monaco-editor 0.57's
    // package exports no longer allow: point it at the same file.
    resolveAlias: {
      "monaco-editor/esm/vs/editor/editor.api.js": "monaco-editor/editor/editor.api.js",
    },
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
