// System alerts already raised (decision 0010), so they aren't sent again on
// every check: "<type>:<who or what>", e.g. "storage_80:<user id>",
// "r2_ops_70:2026-11", "trash_emptying:<item id>". A row goes when the
// threshold isn't crossed any more (or the item leaves the trash).
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const alertStates = pgTable("alert_states", {
  key: text().primaryKey(),
  raisedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
