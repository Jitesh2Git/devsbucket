// Sharing with people (decision 0008): a grant gives one user a role on an
// item and everything inside it. The Owner isn't a grant: it's
// items.owner_id. Roles are resolved by item_access() (../access.ts).
import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth.ts";
import { items } from "./items.ts";

export const grantRoles = ["editor", "viewer"] as const;

export const itemPermissions = pgTable(
  "item_permissions",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    itemId: uuid()
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text({ enum: grantRoles }).notNull(),
    // Who shared it; null once that account is removed.
    grantedBy: uuid().references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check("item_permissions_role_check", sql`${table.role} in ('editor', 'viewer')`),
    // One grant per person per item: changing the role updates it.
    unique("item_permissions_item_id_user_id_unique").on(table.itemId, table.userId),
    // Shared with me (step 6).
    index("item_permissions_user_id_idx").on(table.userId),
  ],
);
