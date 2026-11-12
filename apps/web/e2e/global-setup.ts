import { execFileSync } from "node:child_process";
import { E2E_INVITE_CODE, testEnv } from "./env";

// Runs once before all tests: a fresh, migrated test database with one invite
// (packages/db/src/reset-test-db.ts) and an empty test bucket
// (packages/storage/src/reset-test-bucket.ts).
const globalSetup = () => {
  const env = { ...process.env, ...testEnv(), E2E_INVITE_CODE };
  execFileSync("pnpm", ["--filter", "@devsbucket/db", "db:reset-test"], { stdio: "inherit", env });
  execFileSync("pnpm", ["--filter", "@devsbucket/storage", "storage:reset-test"], {
    stdio: "inherit",
    env,
  });
};

export default globalSetup;
