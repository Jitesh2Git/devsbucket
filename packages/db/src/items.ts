import type { Cursor } from "@devsbucket/shared/item";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "./client.ts";
import { isUniqueViolation } from "./errors.ts";
import { items } from "./schema/items.ts";

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
