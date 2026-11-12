// Prepares the end-to-end test database: creates it if missing, applies the
// migrations, empties it, and adds the invite the tests sign up with.
// Run by apps/web/e2e/global-setup.ts (pnpm --filter @devsbucket/db db:reset-test)
// with DATABASE_URL and E2E_INVITE_CODE set.
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { invites } from "./schema/invites.ts";

const databaseUrl = process.env.DATABASE_URL;
const inviteCode = process.env.E2E_INVITE_CODE;
if (!databaseUrl || !inviteCode) {
  throw new Error("DATABASE_URL and E2E_INVITE_CODE must be set");
}

const url = new URL(databaseUrl);
const name = url.pathname.slice(1);
// This empties every table, so it only ever runs against a *_test database.
if (!name.endsWith("_test")) {
  throw new Error(`Refusing to reset "${name}": the test database name must end in _test`);
}

// Create the database (from the default "postgres" database) if it's missing.
const adminUrl = new URL(databaseUrl);
adminUrl.pathname = "/postgres";
const admin = new pg.Client({ connectionString: adminUrl.toString() });
await admin.connect();
const exists = await admin.query("select 1 from pg_database where datname = $1", [name]);
if (exists.rowCount === 0) {
  await admin.query(`create database "${name}"`);
}
await admin.end();

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
const db = drizzle({ client, casing: "snake_case" });
await migrate(db, { migrationsFolder: new URL("../drizzle", import.meta.url).pathname });
await client.query("truncate users, invites restart identity cascade");
await db.insert(invites).values({
  code: inviteCode,
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
});
await client.end();

console.log(`Test database "${name}" is ready`);
