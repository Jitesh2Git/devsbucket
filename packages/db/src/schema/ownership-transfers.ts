// Ownership transfers (decision 0009): the Owner offers an item to someone
// who already has access; they accept or decline, or the Owner cancels.
// One pending offer per item; decided ones are kept as history.
import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth.ts";
import { items } from "./items.ts";

export const transferStatuses = ["pending", "accepted", "declined", "cancelled"] as const;

export const ownershipTransfers = pgTable(
  "ownership_transfers",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    itemId: uuid()
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    fromUserId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    toUserId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text({ enum: transferStatuses }).notNull().default("pending"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    check(
      "ownership_transfers_status_check",
      sql`${table.status} in ('pending', 'accepted', 'declined', 'cancelled')`,
    ),
    // One pending offer per item.
    uniqueIndex("ownership_transfers_pending_idx")
      .on(table.itemId)
      .where(sql`${table.status} = 'pending'`),
    // The recipient's offers (Shared with me).
    index("ownership_transfers_to_user_id_idx")
      .on(table.toUserId)
      .where(sql`${table.status} = 'pending'`),
  ],
);
