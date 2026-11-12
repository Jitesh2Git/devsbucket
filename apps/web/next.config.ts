import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next allows one `next dev` per build folder, so the end-to-end test
  // server (Playwright) builds into its own folder and can run next to yours.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
