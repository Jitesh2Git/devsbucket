// Recent (Phase 5, decision 0017): when each person last opened each file,
// in the editor or a preview. One row per person per file; recordView keeps
// the newest 100 per person. Diagram 6 calls it ItemView.
import { index, pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth.ts";
import { items } from "./items.ts";

export const itemViews = pgTable(
  "item_views",
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemId: uuid()
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    lastOpenedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.itemId] }),
    // The Recent page and the cap: one person's views, newest first.
    index("item_views_user_id_last_opened_at_idx").on(table.userId, table.lastOpenedAt.desc()),
  ],
);
