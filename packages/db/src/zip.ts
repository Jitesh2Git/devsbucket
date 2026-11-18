// ZIP download of a folder (Phase 5, decision 0017): everything inside it
// that isn't trashed or still uploading, with its path below the folder.
import { sql } from "drizzle-orm";
import { db, type Executor } from "./client.ts";
import { items } from "./schema/items.ts";

// Every ready, untrashed item below `folderId`, with its path ("src/app.ts").
// Names can't contain "/" (itemNameSchema), so the path is unambiguous.
const tree = (folderId: string) => sql`
  with recursive tree as (
    select i.id, i.type, i.size, i.updated_at, i.name::text as path, 1 as depth
    from ${items} i
    where i.parent_id = ${folderId} and i.trashed_at is null and i.status = 'ready'
    union all
    select c.id, c.type, c.size, c.updated_at, t.path || '/' || c.name, t.depth + 1
    from ${items} c
    join tree t on c.parent_id = t.id
    where t.type = 'folder' and c.trashed_at is null and c.status = 'ready' and t.depth < 100
  )
`;

// How many files and bytes a ZIP of the folder would hold: checked against
// the caps before anything is read from storage.
export const zipSummary = async (folderId: string, tx: Executor = db) => {
  const result = await tx.execute<{ files: number; bytes: string }>(sql`
    ${tree(folderId)}
    select count(*) filter (where type = 'file')::int as files,
      coalesce(sum(size) filter (where type = 'file'), 0)::bigint as bytes
    from tree
  `);
  const row = result.rows[0];
  return { files: row?.files ?? 0, bytes: Number(row?.bytes ?? 0) };
};

// The ZIP's entries in path order: folders (empty ones too) and files.
export const listZipEntries = async (folderId: string, tx: Executor = db) => {
  const result = await tx.execute<{
    id: string;
    type: "folder" | "file";
    path: string;
    updated_at: Date;
  }>(sql`
    ${tree(folderId)}
    select id, type, path, updated_at from tree order by path
  `);
  return result.rows.map((row) => ({
    id: row.id,
    type: row.type,
    path: row.path,
    updatedAt: new Date(row.updated_at),
  }));
};
