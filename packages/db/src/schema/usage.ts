// App-wide storage operations per month, to stop before R2's free tier runs
// out (LOCKED.md "Limits"). Total stored bytes is sum(users.storage_used).
import { sql } from "drizzle-orm";
import { bigint, check, pgTable, text } from "drizzle-orm/pg-core";

export const usageCounters = pgTable(
  "usage_counters",
  {
    // "YYYY-MM" (UTC)
    month: text().primaryKey(),
    // Writes and lists (PUT, multipart, list)
    classAOps: bigint({ mode: "number" }).notNull().default(0),
    // Reads (GET, HEAD)
    classBOps: bigint({ mode: "number" }).notNull().default(0),
  },
  (table) => [check("usage_counters_month_check", sql`${table.month} ~ '^[0-9]{4}-[0-9]{2}$'`)],
);
