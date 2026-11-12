// Trash (decision 0007): trashing marks an item and everything inside it;
// the Trash view lists only what the user trashed (trash_root); restore
// brings back what was trashed together; delete forever removes the rows
// and hands back what storage still has to delete.
import { nextAvailableName } from "@devsbucket/shared/item";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
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
    return result.rows.length > 0;
  });
};

const parents = alias(items, "parents");

// What the Trash view shows: the items the user trashed, newest first, with
// the folder each one was in. Capped; the worker empties anything older
// than 30 days (step 11), which keeps the list short.
export const listTrash = async (ownerId: string) => {
  return db
    .select({
      id: items.id,
      type: items.type,
      name: items.name,
      size: items.size,
      trashedAt: items.trashedAt,
      parentId: items.parentId,
      parentName: parents.name,
    })
    .from(items)
    .leftJoin(parents, eq(parents.id, items.parentId))
    .where(and(eq(items.ownerId, ownerId), eq(items.trashRoot, true)))
    .orderBy(desc(items.trashedAt), items.id)
    .limit(200);
};

export type TrashedItem = Awaited<ReturnType<typeof listTrash>>[number];

// A trashed item the user trashed directly (a Trash view row), or null.
export const getTrashRoot = async (id: string) => {
  const [item] = await db
    .select()
    .from(items)
    .where(and(eq(items.id, id), eq(items.trashRoot, true)));
  return item ?? null;
};

// Brings back a trashed item and what was trashed with it. If its folder is
// in the trash now, it goes to the top level of My Drive; if its name was
// taken meanwhile, it gets the next free one (decision 0007).
export const restoreItem = async ({ id, ownerId }: { id: string; ownerId: string }) => {
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
export const deleteForever = async ({ ids, ownerId }: { ids: string[]; ownerId: string }) => {
  return db.transaction(async (tx) => {
    await lockOwner(tx, ownerId);
    const roots = await tx
      .select({ id: items.id })
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
