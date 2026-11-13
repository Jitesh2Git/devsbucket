// Prepares the end-to-end test database: creates it if missing, applies the
// migrations, empties it, and adds the invite the tests sign up with.
// Run by apps/web/e2e/global-setup.ts (pnpm --filter @devsbucket/db db:reset-test)
// with DATABASE_URL and E2E_INVITE_CODE set.
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { invites } from "./schema/invites.ts";
import { prepareTestDatabase } from "./test-database.ts";

const databaseUrl = process.env.DATABASE_URL;
const inviteCode = process.env.E2E_INVITE_CODE;
if (!databaseUrl || !inviteCode) {
  throw new Error("DATABASE_URL and E2E_INVITE_CODE must be set");
}

const name = await prepareTestDatabase(databaseUrl);

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
await client.query("truncate users, invites, usage_counters restart identity cascade");
await drizzle({ client, casing: "snake_case" })
  .insert(invites)
  .values({
    code: inviteCode,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
await client.end();

console.log(`Test database "${name}" is ready`);
