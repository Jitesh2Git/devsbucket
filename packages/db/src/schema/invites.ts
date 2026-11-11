import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth.ts";

// Sign-ups are invite-only: each code can be used once, before it expires.
export const invites = pgTable("invites", {
  id: uuid().primaryKey().default(sql`uuidv7()`),
  code: text().notNull().unique(),
  // Optional: only this email can use the code.
  email: text(),
  // Null when created by the seed script or an admin command.
  createdBy: uuid().references(() => users.id, { onDelete: "set null" }),
  usedBy: uuid().references(() => users.id, { onDelete: "set null" }),
  usedAt: timestamp({ withTimezone: true }),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
