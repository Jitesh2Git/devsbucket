import { defineConfig, devices } from "@playwright/test";

// The smoke test (smoke.spec.ts) against a stack that's already running.
// 📍 apps/web, with an invite from the admin command:
//   SMOKE_INVITE=<code> pnpm test:smoke                          https://localhost
//   SMOKE_URL=https://devsbucket.duckdns.org SMOKE_INVITE=<code> pnpm test:smoke
export default defineConfig({
  testDir: ".",
  workers: 1,
  reporter: "list",
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env.SMOKE_URL ?? "https://localhost",
    // The prod-like stack's certificate comes from Caddy's own local
    // authority, which this browser doesn't know.
    ignoreHTTPSErrors: true,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
