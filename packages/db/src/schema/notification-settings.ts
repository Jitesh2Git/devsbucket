// What each person wants to hear about (decision 0010): a switch per type
// (no row = on) and muted items (a muted folder covers what's inside it).
// The worker checks both before creating a notification; always-on types
// ignore them.
import { notificationTypes } from "@devsbucket/shared/notifications";
import { sql } from "drizzle-orm";
import { boolean, check, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth.ts";
import { items } from "./items.ts";

export const notificationPrefs = pgTable(
  "notification_prefs",
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text({ enum: notificationTypes }).notNull(),
    enabled: boolean().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.type] }),
    check(
      "notification_prefs_type_check",
      sql`${table.type} in (${sql.raw(notificationTypes.map((type) => `'${type}'`).join(", "))})`,
    ),
  ],
);

export const itemMutes = pgTable(
  "item_mutes",
  {
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemId: uuid()
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.itemId] })],
);
