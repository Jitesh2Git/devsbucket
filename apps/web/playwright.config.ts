import { defineConfig, devices } from "@playwright/test";
import { E2E_PORT, testDatabaseUrl } from "./e2e/env";

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
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Its own app server on port 3100, pointed at the test database, so it
  // never touches your dev data or your `pnpm dev` on port 3000.
  webServer: {
    command: process.env.CI ? `next build && next start -p ${E2E_PORT}` : `next dev -p ${E2E_PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      DATABASE_URL: testDatabaseUrl(),
      BETTER_AUTH_URL: baseURL,
      NEXT_DIST_DIR: ".next-e2e",
    },
  },
});
