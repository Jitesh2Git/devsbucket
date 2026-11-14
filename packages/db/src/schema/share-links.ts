// Share links (decision 0008): one active link per item, with a role and an
// optional expiry. Only signed-in people can open one; opening it records a
// visit, and from then on the visit gives them the link's role while the
// link is active (item_access()). Disabling or resetting a link ends its row
// (disabled_at), so its token stops working.
import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth.ts";
import { items } from "./items.ts";
import { grantRoles } from "./permissions.ts";

export const shareLinks = pgTable(
  "share_links",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    itemId: uuid()
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    // 32 random bytes, base64url: the secret part of /s/<token>.
    token: text().notNull().unique(),
    role: text({ enum: grantRoles }).notNull(),
    // null: never expires.
    expiresAt: timestamp({ withTimezone: true }),
    // Set when it's disabled or replaced by a reset.
    disabledAt: timestamp({ withTimezone: true }),
    createdBy: uuid().references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("share_links_role_check", sql`${table.role} in ('editor', 'viewer')`),
    // At most one active link per item.
    uniqueIndex("share_links_active_item_idx")
      .on(table.itemId)
      .where(sql`${table.disabledAt} is null`),
  ],
);

export const shareLinkVisits = pgTable(
  "share_link_visits",
  {
    linkId: uuid()
      .notNull()
      .references(() => shareLinks.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    firstOpenedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.linkId, table.userId] }),
    // Shared with me and item_access() look visits up by user.
    index("share_link_visits_user_id_idx").on(table.userId),
  ],
);
