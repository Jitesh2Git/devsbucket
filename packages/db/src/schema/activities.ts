// One row per action on an item (decision 0010). Kept as long as the item
// exists; "deleted forever" is logged on the folder the item was in.
import { activityActions } from "@devsbucket/shared/activity";
import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth.ts";
import { items } from "./items.ts";

export const activities = pgTable(
  "activities",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    itemId: uuid()
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    // Null when the worker did it (old trash), or once the account is removed.
    actorId: uuid().references(() => users.id, { onDelete: "set null" }),
    action: text({ enum: activityActions }).notNull(),
    metadata: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "activities_action_check",
      sql`${table.action} in (${sql.raw(activityActions.map((action) => `'${action}'`).join(", "))})`,
    ),
    // An item's history, newest first (the activity panel, Phase 5).
    index("activities_item_id_created_at_idx").on(table.itemId, table.createdAt.desc()),
  ],
);
