import { execFileSync } from "node:child_process";
import { E2E_INVITE_CODE, testDatabaseUrl } from "./env";

// Runs once before all tests: a fresh, migrated test database with one invite
// (packages/db/src/reset-test-db.ts).
const globalSetup = () => {
  execFileSync("pnpm", ["--filter", "@devsbucket/db", "db:reset-test"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: testDatabaseUrl(), E2E_INVITE_CODE },
  });
};

export default globalSetup;
