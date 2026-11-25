import { fileURLToPath } from "node:url";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

// The SQL migrations drizzle-kit generates (packages/db/drizzle). Prod has
// no drizzle-kit: the worker image applies them with drizzle-orm's migrator
// (`docker compose run --rm worker node src/migrate.ts`), and so do the tests.
export const MIGRATIONS_FOLDER = fileURLToPath(new URL("../drizzle", import.meta.url));

// Applies the ones not applied yet, in order, each in a transaction (a
// failing one rolls back and stops the rest). Safe to run again.
export const applyMigrations = <TSchema extends Record<string, unknown>>(
  database: NodePgDatabase<TSchema>,
) => migrate(database, { migrationsFolder: MIGRATIONS_FOLDER });
