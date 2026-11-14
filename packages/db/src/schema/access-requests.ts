// Access requests (decision 0008): someone signed in without access asks
// for a role on an item. One pending request per person per item; the
// Owner, or an Editor who may share, approves (with a role) or denies it.
import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth.ts";
import { items } from "./items.ts";
import { grantRoles } from "./permissions.ts";

export const requestStatuses = ["pending", "approved", "denied"] as const;

export const accessRequests = pgTable(
  "access_requests",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    itemId: uuid()
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    requesterId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // The role they asked for; approving may give another.
    role: text({ enum: grantRoles }).notNull(),
    message: text(),
    status: text({ enum: requestStatuses }).notNull().default("pending"),
    decidedBy: uuid().references(() => users.id, { onDelete: "set null" }),
    decidedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("access_requests_role_check", sql`${table.role} in ('editor', 'viewer')`),
    check(
      "access_requests_status_check",
      sql`${table.status} in ('pending', 'approved', 'denied')`,
    ),
    check("access_requests_message_length_check", sql`char_length(${table.message}) <= 500`),
    // One pending request per person per item; decided ones are kept. It
    // also serves the Share dialog's list of an item's pending requests.
    uniqueIndex("access_requests_pending_idx")
      .on(table.itemId, table.requesterId)
      .where(sql`${table.status} = 'pending'`),
  ],
);
