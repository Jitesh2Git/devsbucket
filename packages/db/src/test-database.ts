// The test database (devsbucket_test) sits next to the dev one. Shared by
// the e2e reset (reset-test-db.ts) and the database tests (`pnpm test:db`).
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

// devsbucket -> devsbucket_test; a URL that already ends in _test stays.
export const testDatabaseUrl = (databaseUrl: string) => {
  const url = new URL(databaseUrl);
  if (!url.pathname.endsWith("_test")) {
    url.pathname = `${url.pathname}_test`;
  }
  return url.toString();
};

// These helpers empty tables, so they only ever touch a *_test database.
export const assertTestDatabase = (databaseUrl: string) => {
  const name = new URL(databaseUrl).pathname.slice(1);
  if (!name.endsWith("_test")) {
    throw new Error(`Refusing to use "${name}": the test database name must end in _test`);
  }
  return name;
};

// Creates the test database if it's missing and applies the migrations.
export const prepareTestDatabase = async (databaseUrl: string) => {
  const name = assertTestDatabase(databaseUrl);
  // Create it from the default "postgres" database.
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
  await migrate(drizzle({ client, casing: "snake_case" }), {
    migrationsFolder: new URL("../drizzle", import.meta.url).pathname,
  });
  await client.end();
  return name;
};
