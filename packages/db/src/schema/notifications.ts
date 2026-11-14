// Notifications (decision 0010): made by the worker from activity (and, in
// step 13, by scheduled checks). Deleted after 90 days.
import { notificationTypes } from "@devsbucket/shared/notifications";
import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth.ts";
import { items } from "./items.ts";

export const notifications = pgTable(
  "notifications",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    recipientId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Null for system notifications, or once that account is removed.
    actorId: uuid().references(() => users.id, { onDelete: "set null" }),
    type: text({ enum: notificationTypes }).notNull(),
    // What clicking it opens; null for system notifications.
    itemId: uuid().references(() => items.id, { onDelete: "cascade" }),
    // Names and roles for the sentence (never file contents).
    payload: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    // Batched content notifications: how many it stands for.
    count: integer().notNull().default(1),
    readAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "notifications_type_check",
      sql`${table.type} in (${sql.raw(notificationTypes.map((type) => `'${type}'`).join(", "))})`,
    ),
    // Someone's notifications, newest first.
    index("notifications_recipient_created_idx").on(table.recipientId, table.createdAt.desc()),
    // The unread count.
    index("notifications_unread_idx").on(table.recipientId).where(sql`${table.readAt} is null`),
  ],
);
