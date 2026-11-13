// Trash (decision 0007): trashing marks an item and everything inside it;
// the Trash view lists only what the user trashed (trash_root); restore
// brings back what was trashed together; delete forever removes the rows
// and hands back what storage still has to delete.
import { nextAvailableName } from "@devsbucket/shared/item";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { logActivity } from "./activity.ts";
import { db, type Executor } from "./client.ts";
import { takenNames } from "./items.ts";
import { users } from "./schema/auth.ts";
import { items } from "./schema/items.ts";
import { releaseStorage } from "./usage.ts";

// Trash and restore take turns per tree (like moves), so a restore can't
// pick a name that a parallel restore is picking too.
const lockOwner = (tx: Executor, ownerId: string) =>
  tx.execute(sql`select 1 from ${users} where id = ${ownerId} for update`);

// Moves an item and everything inside it that isn't trashed yet to the
// trash, with one timestamp, so restore can tell what went together.
// Things trashed earlier inside it keep their own timestamp.
export const trashItem = async ({
  id,
  ownerId,
  trashedBy,
}: {
  id: string;
  ownerId: string;
  trashedBy: string;
}) => {
  return db.transaction(async (tx) => {
    await lockOwner(tx, ownerId);
    const result = await tx.execute<{ id: string }>(sql`
      with recursive tree as (
        select id from ${items}
        where id = ${id} and owner_id = ${ownerId} and trashed_at is null
        union all
        select i.id from ${items} i join tree t on i.parent_id = t.id
        where i.trashed_at is null
      )
      update ${items}
      set trashed_at = now(), trashed_by = ${trashedBy}, trash_root = (id = ${id})
      where id in (select id from tree)
      returning id
    `);
    if (result.rows.length === 0) {
      return false;
    }
    await logActivity(tx, { itemId: id, actorId: trashedBy, action: "trashed", metadata: {} });
    return true;
  });
};

const parents = alias(items, "parents");
const trashers = alias(users, "trashers");

// What a user's Trash view shows, newest first, with the folder each item
// was in and who trashed it: everything trashed in their own trees, and
// what they trashed in other people's trees while they're still an Editor
// there, so they can restore it (decision 0008). Capped; the worker empties
// anything older than 30 days, which keeps the list short.
export const listTrash = async (userId: string, tx: Executor = db) => {
  return tx
    .select({
      id: items.id,
      type: items.type,
      name: items.name,
      size: items.size,
      ownerId: items.ownerId,
      trashedAt: items.trashedAt,
      trashedBy: items.trashedBy,
      trashedByName: trashers.name,
      parentId: items.parentId,
      parentName: parents.name,
    })
    .from(items)
    .leftJoin(parents, eq(parents.id, items.parentId))
    .leftJoin(trashers, eq(trashers.id, items.trashedBy))
    .where(
      and(
        eq(items.trashRoot, true),
        or(
          eq(items.ownerId, userId),
          and(
            eq(items.trashedBy, userId),
            sql`(select role from item_access(${userId}, ${items.id})) = 'editor'`,
          ),
        ),
      ),
    )
    .orderBy(desc(items.trashedAt), items.id)
    .limit(200);
};

export type TrashedItem = Awaited<ReturnType<typeof listTrash>>[number];

// Brings back a trashed item and what was trashed with it. If its folder is
// in the trash now, it goes to the top level of My Drive; if its name was
// taken meanwhile, it gets the next free one (decision 0007).
export const restoreItem = async ({
  id,
  ownerId,
  actorId,
}: {
  id: string;
  ownerId: string;
  actorId: string;
}) => {
  return db.transaction(async (tx) => {
    await lockOwner(tx, ownerId);
    const [root] = await tx
      .select()
      .from(items)
      .where(and(eq(items.id, id), eq(items.ownerId, ownerId), eq(items.trashRoot, true)));
    if (!root?.trashedAt) {
      return null;
    }
    let parentId = root.parentId;
    if (parentId !== null) {
      const [parent] = await tx
        .select({ trashedAt: items.trashedAt })
        .from(items)
        .where(eq(items.id, parentId));
      if (!parent || parent.trashedAt !== null) {
        parentId = null;
      }
    }
    const name = nextAvailableName(
      root.name,
      await takenNames(tx, { ownerId, parentId, name: root.name }),
      { keepExtension: root.type !== "folder" },
    );
    // Everything trashed in the same moment as the root, under the root.
    // Compared in SQL: Postgres keeps microseconds, a JavaScript Date only
    // milliseconds, so root.trashedAt would never be equal.
    await tx.execute(sql`
      with recursive moment as (
        select trashed_at from ${items} where id = ${root.id}
      ), tree as (
        select i.id from ${items} i, moment m
        where i.parent_id = ${root.id} and i.trashed_at = m.trashed_at
        union all
        select i.id from ${items} i join tree t on i.parent_id = t.id, moment m
        where i.trashed_at = m.trashed_at
      )
      update ${items} set trashed_at = null, trashed_by = null
      where id in (select id from tree)
    `);
    await tx
      .update(items)
      .set({ parentId, name, trashedAt: null, trashedBy: null, trashRoot: false })
      .where(eq(items.id, root.id));
    await logActivity(tx, {
      itemId: root.id,
      actorId,
      action: "restored",
      metadata: { name, movedToTop: parentId !== root.parentId },
    });
    return {
      name,
      renamed: name !== root.name,
      movedToTop: parentId !== root.parentId,
    };
  });
};

// Deletes trashed items (Trash view rows) forever: the rows and everything
// inside them (the parent_id cascade), and their bytes from the owner's
// quota. Returns what's left to delete from storage: object keys and
// unfinished multipart uploads.
export const deleteForever = async ({
  ids,
  ownerId,
  actorId,
}: {
  ids: string[];
  ownerId: string;
  // null: the worker, emptying old trash.
  actorId: string | null;
}) => {
  return db.transaction(async (tx) => {
    await lockOwner(tx, ownerId);
    const roots = await tx
      .select({ id: items.id, parentId: items.parentId, name: items.name, type: items.type })
      .from(items)
      .where(and(inArray(items.id, ids), eq(items.ownerId, ownerId), eq(items.trashRoot, true)));
    if (roots.length === 0) {
      return { deleted: 0, storageKeys: [], uploads: [] };
    }
    const rootIds = roots.map((root) => root.id);
    const files = await tx.execute<{
      storage_key: string;
      upload_id: string | null;
      size: string | null;
    }>(sql`
      with recursive tree as (
        select id from ${items} where id in ${rootIds}
        union all
        select i.id from ${items} i join tree t on i.parent_id = t.id
      )
      select storage_key, upload_id, size from ${items}
      where id in (select id from tree) and type = 'file' and storage_key is not null
    `);
    // The item is about to go, so this is logged on the folder it was in. A
    // top-level item has no folder: nobody else can see that level anyway.
    for (const root of roots) {
      if (root.parentId !== null) {
        await logActivity(tx, {
          itemId: root.parentId,
          actorId,
          action: "deleted_forever",
          metadata: { name: root.name, type: root.type },
        });
      }
    }
    await tx.delete(items).where(inArray(items.id, rootIds));
    const bytes = files.rows.reduce((sum, file) => sum + Number(file.size ?? 0), 0);
    await releaseStorage(ownerId, bytes, tx);
    return {
      deleted: rootIds.length,
      storageKeys: files.rows.map((file) => file.storage_key),
      uploads: files.rows.flatMap((file) =>
        file.upload_id ? [{ key: file.storage_key, uploadId: file.upload_id }] : [],
      ),
    };
  });
};

// Every Trash view row of one owner, for Empty trash.
export const listTrashRootIds = async (ownerId: string) => {
  const rows = await db
    .select({ id: items.id })
    .from(items)
    .where(and(eq(items.ownerId, ownerId), eq(items.trashRoot, true)));
  return rows.map((row) => row.id);
};

// Trash rows (of every owner) trashed more than `days` ago, oldest first:
// the worker deletes them forever. The age is measured by Postgres's clock.
export const listExpiredTrash = async ({ days, limit }: { days: number; limit: number }) => {
  return db
    .select({ id: items.id, ownerId: items.ownerId })
    .from(items)
    .where(
      and(
        eq(items.trashRoot, true),
        sql`${items.trashedAt} < now() - make_interval(days => ${days})`,
      ),
    )
    .orderBy(items.trashedAt)
    .limit(limit);
};
