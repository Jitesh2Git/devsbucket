// Live editing (Phase 4, decision 0013): the live Yjs document of each file
// being edited, and the saved versions of its text. Both live in Postgres;
// the file's object in storage is rewritten when a version is saved.
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  check,
  customType,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth.ts";
import { items } from "./items.ts";

// Drizzle 0.45 has no bytea column: raw bytes in, a Buffer out (pg returns
// bytea as a Buffer).
const bytea = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType: () => "bytea",
  toDriver: (value) => Buffer.from(value),
  fromDriver: (value) => new Uint8Array(value),
});

export const versionKinds = ["auto", "named", "restore"] as const;

// One row per file that has been opened in the editor: the whole Yjs
// document as one update (Y.encodeStateAsUpdate). The working copy, so not
// counted in the quota.
export const collabStates = pgTable("collab_states", {
  itemId: uuid()
    .primaryKey()
    .references(() => items.id, { onDelete: "cascade" }),
  state: bytea().notNull(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// Saved versions: the full text each time. auto: every 5 minutes and when
// the last person leaves (thinned after 30 days); named: saved by hand with
// a message; restore: an old version brought back. Counted in the owner's
// quota through items.versions_size.
export const itemVersions = pgTable(
  "item_versions",
  {
    id: uuid().primaryKey().default(sql`uuidv7()`),
    itemId: uuid()
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    // 1, 2, 3, … per file; version 1 is the text before the first edit.
    number: integer().notNull(),
    kind: text({ enum: versionKinds }).notNull(),
    // Named versions only (the restore message is built from restoredFrom).
    message: text(),
    content: text().notNull(),
    // UTF-8 bytes of content.
    size: bigint({ mode: "number" }).notNull(),
    // Who changed the text since the previous version. No foreign key
    // (Postgres can't on arrays): a removed account shows as "Deleted user".
    authors: uuid().array().notNull().default(sql`'{}'::uuid[]`),
    restoredFrom: uuid().references((): AnyPgColumn => itemVersions.id, {
      onDelete: "set null",
    }),
    // Who saved a named or restore version; null for auto.
    createdBy: uuid().references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("item_versions_kind_check", sql`${table.kind} in ('auto', 'named', 'restore')`),
    check(
      "item_versions_message_check",
      sql`${table.message} is null or char_length(${table.message}) between 1 and 200`,
    ),
    unique("item_versions_item_number_unique").on(table.itemId, table.number),
    // The history panel, newest first.
    index("item_versions_item_created_idx").on(table.itemId, table.createdAt.desc()),
  ],
);
