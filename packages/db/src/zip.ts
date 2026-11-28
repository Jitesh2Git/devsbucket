// ZIP download of a folder (Phase 5, decision 0017): everything inside it
// that isn't trashed or still uploading, with its path below the folder.
// Or of several selected items (multi-select): each one at the top of the
// ZIP, a folder with everything inside it.
import { type SQL, sql } from "drizzle-orm";
import { db, type Executor } from "./client.ts";
import { items } from "./schema/items.ts";

// What a ZIP starts from: the items inside a folder, or the selected ones.
export type ZipRoots = { folderId: string } | { itemIds: string[] };

const seed = (roots: ZipRoots): SQL =>
  "folderId" in roots
    ? sql`i.parent_id = ${roots.folderId}`
    : sql`i.id in (${sql.join(
        roots.itemIds.map((id) => sql`${id}`),
        sql`, `,
      )})`;

// Every ready, untrashed item from the roots down, with its path
// ("src/app.ts"). Names can't contain "/" (itemNameSchema), so the path is
// unambiguous; selected items share one folder, so their names differ too.
const tree = (roots: ZipRoots) => sql`
  with recursive tree as (
    select i.id, i.type, i.size, i.updated_at, i.name::text as path, 1 as depth
    from ${items} i
    where ${seed(roots)} and i.trashed_at is null and i.status = 'ready'
    union all
    select c.id, c.type, c.size, c.updated_at, t.path || '/' || c.name, t.depth + 1
    from ${items} c
    join tree t on c.parent_id = t.id
    where t.type = 'folder' and c.trashed_at is null and c.status = 'ready' and t.depth < 100
  )
`;

// A folder id alone means "inside that folder".
const asRoots = (roots: string | ZipRoots): ZipRoots =>
  typeof roots === "string" ? { folderId: roots } : roots;

// How many files and bytes a ZIP of the folder would hold: checked against
// the caps before anything is read from storage.
export const zipSummary = async (roots: string | ZipRoots, tx: Executor = db) => {
  const result = await tx.execute<{ files: number; bytes: string }>(sql`
    ${tree(asRoots(roots))}
    select count(*) filter (where type = 'file')::int as files,
      coalesce(sum(size) filter (where type = 'file'), 0)::bigint as bytes
    from tree
  `);
  const row = result.rows[0];
  return { files: row?.files ?? 0, bytes: Number(row?.bytes ?? 0) };
};

// The ZIP's entries in path order: folders (empty ones too) and files.
export const listZipEntries = async (roots: string | ZipRoots, tx: Executor = db) => {
  const result = await tx.execute<{
    id: string;
    type: "folder" | "file";
    path: string;
    updated_at: Date;
  }>(sql`
    ${tree(asRoots(roots))}
    select id, type, path, updated_at from tree order by path
  `);
  return result.rows.map((row) => ({
    id: row.id,
    type: row.type,
    path: row.path,
    updatedAt: new Date(row.updated_at),
  }));
};
