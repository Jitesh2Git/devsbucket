// Applies pending database migrations (packages/db/drizzle) with
// drizzle-orm's migrator, so prod needs no drizzle-kit:
//   docker compose run --rm worker node src/migrate.ts   (prod, before a deploy)
//   pnpm --filter worker migrate                         (locally; `pnpm db:migrate` too)
// A failing migration rolls back and exits non-zero, so a deploy stops.
import { db, pool } from "@devsbucket/db/client";
import { applyMigrations } from "@devsbucket/db/migrations";
import { log } from "./log.ts";

try {
  await applyMigrations(db);
  log("migrations applied");
} finally {
  await pool.end();
}
