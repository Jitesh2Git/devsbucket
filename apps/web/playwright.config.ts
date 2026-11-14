import { defineConfig, devices } from "@playwright/test";
import { E2E_PORT, E2E_REALTIME_PORT, testDatabaseUrl, testEnv } from "./e2e/env";

// Locally, read DATABASE_URL and the auth secrets from .env.local.
// In CI they come from the environment instead.
if (!process.env.CI) {
  process.loadEnvFile(".env.local");
}

const baseURL = `http://localhost:${E2E_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  // The tests share one database, so run them one at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  // Locally `next dev` on a busy laptop can take more than 5 s to answer.
  expect: { timeout: process.env.CI ? 5_000 : 10_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Its own app server on port 3100, realtime server on 3101 and worker,
  // pointed at the test database and test bucket, so they never touch your
  // dev data or your `pnpm dev`.
  webServer: [
    {
      command: process.env.CI
        ? `next build && next start -p ${E2E_PORT}`
        : `next dev -p ${E2E_PORT}`,
      url: baseURL,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...process.env,
        // The test database and bucket, never the dev ones.
        ...testEnv(),
        BETTER_AUTH_URL: baseURL,
        NEXT_DIST_DIR: ".next-e2e",
        NEXT_PUBLIC_REALTIME_URL: `ws://localhost:${E2E_REALTIME_PORT}`,
        // Every test signs up its own user; see lib/auth.ts.
        AUTH_RATE_LIMIT: "off",
      },
    },
    {
      // Without --env-file: apps/realtime/.env points at the dev database.
      command: "node src/index.ts",
      cwd: "../realtime",
      url: `http://localhost:${E2E_REALTIME_PORT}/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        ...process.env,
        DATABASE_URL: testDatabaseUrl(),
        WEB_URL: baseURL,
        PORT: String(E2E_REALTIME_PORT),
      },
    },
    {
      // The worker turns activity into notifications. No port: it's ready
      // when it says so. Without --env-file, like realtime. On a fresh
      // machine the test database only exists after globalSetup, which runs
      // once these servers are up: "waiting for the database" counts too
      // (the worker starts properly a moment later).
      command: "node src/index.ts",
      cwd: "../worker",
      wait: { stdout: /\[worker\] (started|database not ready)/ },
      reuseExistingServer: false,
      timeout: 60_000,
      env: { ...process.env, ...testEnv() },
    },
  ],
});
