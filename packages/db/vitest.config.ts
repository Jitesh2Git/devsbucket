import { existsSync } from "node:fs";
import { defineConfig } from "vitest/config";
import { testDatabaseUrl } from "./src/test-database.ts";

// `pnpm test:db`: tests that need Postgres (*.db.test.ts), always against
// the test database next to the dev one (devsbucket_test). Locally the URL
// comes from packages/db/.env; in CI it is set directly.
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}
// Set before anything imports client.ts, which reads it.
process.env.DATABASE_URL = testDatabaseUrl(databaseUrl);

export default defineConfig({
  test: {
    include: ["src/**/*.db.test.ts"],
    globalSetup: ["./src/test-setup.ts"],
    env: { DATABASE_URL: process.env.DATABASE_URL },
  },
});
