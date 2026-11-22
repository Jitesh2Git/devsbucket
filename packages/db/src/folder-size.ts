// A folder's size: the ready files below it, at any depth, added up when the
// list is read (nothing is stored, so it can never go stale). Only what's in
// the same state as the folder counts: in a live folder, what isn't in the
// trash; in a trashed folder, what was trashed with it (same trashed_at), so
// the Trash shows what a restore brings back. Pending uploads don't count.
// One recursive query per folder row, using the parent_id index; a page
// shows at most 50 rows.
import { sql } from "drizzle-orm";
import { items } from "./schema/items.ts";

// For a row of `table` (the outer query's name for items: "items", or an
// alias like "i"): a file's own size, or a folder's total. Written with the
// table name on purpose: in a one-table select Drizzle leaves its columns
// unqualified, and inside this subquery "id" would mean the inner row's.
export const sizeOrFolderSize = (table: string) => {
  const row = sql.identifier(table);
  return sql`case when ${row}.type = 'folder' then (
    with recursive tree as (
      select c.id, c.type, c.size, c.status, 1 as depth from ${items} c
      where c.parent_id = ${row}.id and c.trashed_at is not distinct from ${row}.trashed_at
      union all
      select c.id, c.type, c.size, c.status, t.depth + 1
      from ${items} c join tree t on c.parent_id = t.id
      -- A guard: moves never create cycles, but a loop must never hang a page.
      where c.trashed_at is not distinct from ${row}.trashed_at and t.depth < 100
    )
    select coalesce(sum(size), 0) from tree where type = 'file' and status = 'ready'
  ) else ${row}.size end`.mapWith(
    // Postgres sends the sum as a numeric string. Typed as number | null,
    // like the size column it replaces (Drizzle only calls this for non-null).
    (value): number | null => Number(value),
  );
};
