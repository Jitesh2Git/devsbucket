// My Drive: folders, files (and Phase 5 notes) in one table, each pointing to
// its parent like a file system. Plan: docs/plans/phase-2.md, decision 0007.
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth.ts";

export const itemTypes = ["folder", "file", "note"] as const;
export const itemStatuses = ["pending", "ready"] as const;

export const items = pgTable(
  "items",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    // Whose tree this is; quota is charged to them (decision 0002).
    ownerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Null = top level of My Drive (there is no root row).
    parentId: uuid().references((): AnyPgColumn => items.id, { onDelete: "cascade" }),
    createdBy: uuid().references(() => users.id, { onDelete: "set null" }),
    type: text({ enum: itemTypes }).notNull(),
    name: text().notNull(),
    // Files only.
    mimeType: text(),
    size: bigint({ mode: "number" }),
    // Files only: `items/<item id>`, so renames never touch storage.
    storageKey: text().unique("items_storage_key_unique"),
    status: text({ enum: itemStatuses }).notNull().default("ready"),
    // S3 multipart upload id while a large upload is pending.
    uploadId: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    // Set on the trashed item and everything inside it.
    trashedAt: timestamp({ withTimezone: true }),
    trashedBy: uuid().references(() => users.id, { onDelete: "set null" }),
    // True only on the item the user trashed (what the Trash view lists).
    trashRoot: boolean().notNull().default(false),
  },
  (table) => [
    check("items_type_check", sql`${table.type} in ('folder', 'file', 'note')`),
    check("items_status_check", sql`${table.status} in ('pending', 'ready')`),
    check("items_name_length_check", sql`char_length(${table.name}) between 1 and 255`),
    check("items_not_own_parent_check", sql`${table.parentId} <> ${table.id}`),
    // Unique name per folder, ignoring case, outside the trash (decision 0007).
    // coalesce() makes the top level (parent_id null) behave like one folder.
    uniqueIndex("items_unique_name_idx")
      .on(
        table.ownerId,
        sql`coalesce(${table.parentId}, ${table.ownerId})`,
        sql`lower(${table.name})`,
      )
      .where(sql`${table.trashedAt} is null`),
    // Listing a folder: folders first, then by name, outside the trash
    // (keyset pagination on the same three keys; see ../items.ts).
    index("items_parent_list_idx")
      .on(table.parentId, sql`(${table.type} <> 'folder')`, sql`lower(${table.name})`, table.id)
      .where(sql`${table.trashedAt} is null`),
    // Listing the top level of My Drive.
    index("items_top_level_list_idx")
      .on(table.ownerId, sql`(${table.type} <> 'folder')`, sql`lower(${table.name})`, table.id)
      .where(sql`${table.parentId} is null and ${table.trashedAt} is null`),
    // Trash view.
    index("items_trash_idx").on(table.ownerId, table.trashedAt).where(sql`${table.trashRoot}`),
    // Worker: abandoned uploads.
    index("items_pending_idx")
      .on(table.status, table.createdAt)
      .where(sql`${table.status} = 'pending'`),
  ],
);
