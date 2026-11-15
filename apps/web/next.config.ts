import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next allows one `next dev` per build folder, so the end-to-end test
  // server (Playwright) builds into its own folder and can run next to yours.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
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
