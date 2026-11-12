import { type Cursor, nextAvailableName, splitExtension } from "@devsbucket/shared/item";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, type Executor } from "./client.ts";
import { isUniqueViolation } from "./errors.ts";
import { users } from "./schema/auth.ts";
import { items } from "./schema/items.ts";
import { releaseStorage, reserveStorage } from "./usage.ts";

export type Item = typeof items.$inferSelect;

export const PAGE_SIZE = 50;

// The listing's sort key: folders first, then by name ignoring case, then id
// (so equal names still have a fixed order). Same expressions as the
// items_parent_list_idx / items_top_level_list_idx indexes, so Postgres
// reads the rows in order straight from the index.
const notFolder = sql<boolean>`(${items.type} <> 'folder')`;
const sortName = sql<string>`lower(${items.name})`;

export const getItem = async (id: string) => {
  const [item] = await db.select().from(items).where(eq(items.id, id));
  return item ?? null;
};

// One page of a folder (or of the top level of `ownerId`'s My Drive when
// parentId is null). Callers check permissions on the folder first.
export const listItems = async ({
  ownerId,
  parentId,
  cursor,
}: {
  ownerId: string;
  parentId: string | null;
  cursor: Cursor | null;
}) => {
  const rows = await db
    .select({
      id: items.id,
      type: items.type,
      name: items.name,
      mimeType: items.mimeType,
      size: items.size,
      updatedAt: items.updatedAt,
      notFolder,
      sortName,
    })
    .from(items)
    .where(
      and(
        parentId === null
          ? and(eq(items.ownerId, ownerId), isNull(items.parentId))
          : eq(items.parentId, parentId),
        isNull(items.trashedAt),
        // Uploads in progress show in the uploads panel, not here.
        eq(items.status, "ready"),
        // Keyset pagination: everything after the last row of the previous
        // page, compared as a whole row, in the same order as ORDER BY.
        cursor
          ? sql`(${notFolder}, ${sortName}, ${items.id}) > (${cursor.notFolder}, ${cursor.sortName}, ${cursor.id})`
          : undefined,
      ),
    )
    .orderBy(notFolder, sortName, items.id)
    // One extra row tells us whether there's a next page.
    .limit(PAGE_SIZE + 1);

  const page = rows.slice(0, PAGE_SIZE);
  const last = page.at(-1);
  const nextCursor: Cursor | null =
    rows.length > PAGE_SIZE && last
      ? { notFolder: last.notFolder, sortName: last.sortName, id: last.id }
      : null;

  return {
    items: page.map(({ notFolder: _, sortName: __, ...item }) => item),
    nextCursor,
  };
};

export type ListItemsPage = Awaited<ReturnType<typeof listItems>>;
export type ListedItem = ListItemsPage["items"][number];

// The folders from the top of My Drive down to `folderId` (itself included),
// in one recursive query up the parent chain.
export const getBreadcrumbs = async (folderId: string) => {
  const result = await db.execute<{ id: string; name: string }>(sql`
    with recursive chain as (
      select id, parent_id, name, 0 as depth from ${items} where id = ${folderId}
      union all
      select i.id, i.parent_id, i.name, c.depth + 1
      from ${items} i join chain c on i.id = c.parent_id
      -- A guard: moves never create cycles, but a loop must never hang a page.
      where c.depth < 100
    )
    select id, name from chain order by depth desc
  `);
  return result.rows;
};

// Creates a folder, or says the name is taken in that folder (the unique
// index decides, so two people creating the same name at once can't both win).
export const createFolder = async (values: {
  ownerId: string;
  parentId: string | null;
  createdBy: string;
  name: string;
}) => {
  try {
    const [folder] = await db
      .insert(items)
      .values({ ...values, type: "folder" })
      .returning({ id: items.id, name: items.name });
    if (!folder) {
      throw new Error("Insert returned no row");
    }
    return { ok: true, folder } as const;
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, reason: "name-taken" } as const;
    }
    throw error;
  }
};

// Every name in a folder that starts like `name` without its extension: all
// that nextAvailableName needs to pick "notes (1).md", without reading a
// whole folder. Trashed items don't count; pending uploads do.
export const takenNames = async (
  tx: Executor,
  { ownerId, parentId, name }: { ownerId: string; parentId: string | null; name: string },
) => {
  const [base] = splitExtension(name);
  const rows = await tx
    .select({ name: items.name })
    .from(items)
    .where(
      and(
        parentId === null
          ? and(eq(items.ownerId, ownerId), isNull(items.parentId))
          : eq(items.parentId, parentId),
        isNull(items.trashedAt),
        sql`starts_with(lower(${items.name}), lower(${base}))`,
      ),
    );
  return rows.map((row) => row.name);
};

// The start of an upload: its size taken from the owner's quota and a
// `pending` file row under the first free name, in one transaction (both or
// neither). Reserving locks the owner's row until the transaction ends, so
// uploads into the same tree take turns here and see each other's names;
// the unique index is still the final judge, and a clash just tries again.
export const createPendingFile = async (values: {
  ownerId: string;
  parentId: string | null;
  createdBy: string;
  name: string;
  mimeType: string;
  size: number;
  storageKeyFor: (itemId: string) => string;
}) => {
  const { storageKeyFor, ...file } = values;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await db.transaction(async (tx) => {
        const reserved = await reserveStorage(file.ownerId, file.size, tx);
        if (!reserved.ok) {
          return {
            ok: false,
            reason: "quota",
            used: reserved.used,
            quota: reserved.quota,
          } as const;
        }
        const name = nextAvailableName(file.name, await takenNames(tx, file), {
          keepExtension: true,
        });
        // The id is needed for the storage key, so ask Postgres for one first.
        const { rows } = await tx.execute<{ id: string }>(sql`select uuidv7() as id`);
        const id = rows[0]?.id;
        if (!id) {
          throw new Error("uuidv7() returned no row");
        }
        const [created] = await tx
          .insert(items)
          .values({
            ...file,
            id,
            name,
            type: "file",
            status: "pending",
            storageKey: storageKeyFor(id),
          })
          .returning();
        if (!created) {
          throw new Error("Insert returned no row");
        }
        return { ok: true, file: created } as const;
      });
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
    }
  }
  throw new Error("No free name after 3 attempts");
};

// The upload arrived: the file shows up in its folder.
export const markFileReady = async (id: string) => {
  const [file] = await db
    .update(items)
    .set({ status: "ready" })
    .where(and(eq(items.id, id), eq(items.status, "pending")))
    .returning();
  return file ?? null;
};

// A cancelled or failed upload: the row goes and its size returns to the
// owner's quota, together. Returns the deleted row (its storage key still
// has to be deleted from storage), or null if it was no longer pending.
export const deletePendingFile = async (id: string) => {
  return db.transaction(async (tx) => {
    const [file] = await tx
      .delete(items)
      .where(and(eq(items.id, id), eq(items.status, "pending")))
      .returning();
    if (file) {
      await releaseStorage(file.ownerId, file.size ?? 0, tx);
    }
    return file ?? null;
  });
};

// Remembers a pending file's multipart upload, so a cancel, a failed upload
// or the cleanup job (step 11) can abort it.
export const setUploadId = async (id: string, uploadId: string) => {
  await db
    .update(items)
    .set({ uploadId })
    .where(and(eq(items.id, id), eq(items.status, "pending")));
};

// The folders directly inside a folder (or the top level), by name, for the
// Move dialog's folder picker. Capped: a picker with thousands of folders
// at one level isn't usable anyway.
export const listFolders = async ({
  ownerId,
  parentId,
}: {
  ownerId: string;
  parentId: string | null;
}) => {
  return db
    .select({ id: items.id, name: items.name })
    .from(items)
    .where(
      and(
        parentId === null
          ? and(eq(items.ownerId, ownerId), isNull(items.parentId))
          : eq(items.parentId, parentId),
        eq(items.type, "folder"),
        isNull(items.trashedAt),
      ),
    )
    .orderBy(sortName, items.id)
    .limit(500);
};

// Renames an item; the unique index refuses a name already in its folder.
export const renameItem = async (id: string, name: string) => {
  try {
    const [renamed] = await db
      .update(items)
      .set({ name })
      .where(and(eq(items.id, id), isNull(items.trashedAt)))
      .returning({ id: items.id, name: items.name, parentId: items.parentId });
    return renamed
      ? ({ ok: true, item: renamed } as const)
      : ({ ok: false, reason: "gone" } as const);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, reason: "name-taken" } as const;
    }
    throw error;
  }
};

// Is `folderId` the folder `ancestorId` itself, or somewhere inside it?
// Walks up from folderId, like the breadcrumbs.
const isInside = async (tx: Executor, folderId: string, ancestorId: string) => {
  const result = await tx.execute<{ found: boolean }>(sql`
    with recursive chain as (
      select id, parent_id, 0 as depth from ${items} where id = ${folderId}
      union all
      select i.id, i.parent_id, c.depth + 1
      from ${items} i join chain c on i.id = c.parent_id
      where c.depth < 100
    )
    select exists (select 1 from chain where id = ${ancestorId}) as found
  `);
  return result.rows[0]?.found ?? false;
};

// Moves an item into another folder of the same tree (or its top level).
// A folder can't go into itself or anything inside it: that would cut the
// subtree off from My Drive in a loop. Moves in one tree take turns (the
// owner's row is locked), so two opposite moves at once can't make a loop.
export const moveItem = async ({
  id,
  ownerId,
  parentId,
}: {
  id: string;
  ownerId: string;
  parentId: string | null;
}) => {
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`select 1 from ${users} where id = ${ownerId} for update`);
      if (parentId !== null && (await isInside(tx, parentId, id))) {
        return { ok: false, reason: "into-itself" } as const;
      }
      const [moved] = await tx
        .update(items)
        .set({ parentId })
        .where(and(eq(items.id, id), eq(items.ownerId, ownerId), isNull(items.trashedAt)))
        .returning({ id: items.id, name: items.name, parentId: items.parentId });
      return moved
        ? ({ ok: true, item: moved } as const)
        : ({ ok: false, reason: "gone" } as const);
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, reason: "name-taken" } as const;
    }
    throw error;
  }
};
