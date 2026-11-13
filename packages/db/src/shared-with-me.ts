// Shared with me (decision 0008): the top-most items shared with a user. A
// folder and a file inside it both shared with you list only the folder;
// the file is reached by browsing it.
import type { GrantRole } from "@devsbucket/shared/sharing";
import { sql } from "drizzle-orm";
import { db, type Executor } from "./client.ts";
import { users } from "./schema/auth.ts";
import { items } from "./schema/items.ts";
import { itemPermissions } from "./schema/permissions.ts";

export const SHARED_LIMIT = 200;

// Newest share first. Capped like the Trash: a list that long isn't
// browsed by scrolling anyway.
export const listSharedWithMe = async (userId: string, tx: Executor = db) => {
  const result = await tx.execute<{
    id: string;
    type: "folder" | "file" | "note";
    name: string;
    mime_type: string | null;
    size: string | null;
    role: GrantRole;
    shared_at: Date;
    owner_name: string;
  }>(sql`
    select i.id, i.type, i.name, i.mime_type, i.size, p.role,
      p.created_at as shared_at, u.name as owner_name
    from ${itemPermissions} p
    join ${items} i on i.id = p.item_id
    join ${users} u on u.id = i.owner_id
    where p.user_id = ${userId}
      and i.owner_id <> ${userId}
      and i.trashed_at is null
      and i.status = 'ready'
      -- Top-most: no grant for this user on any folder above it.
      and not exists (
        with recursive above as (
          select a.id, a.parent_id, 1 as depth from ${items} a where a.id = i.parent_id
          union all
          select a.id, a.parent_id, x.depth + 1
          from ${items} a join above x on a.id = x.parent_id
          where x.depth < 100
        )
        select 1 from above
        join ${itemPermissions} q on q.item_id = above.id and q.user_id = ${userId}
      )
    order by p.created_at desc, i.id
    limit ${SHARED_LIMIT}
  `);
  return result.rows.map((row) => ({
    id: row.id,
    type: row.type,
    name: row.name,
    mimeType: row.mime_type,
    size: row.size === null ? null : Number(row.size),
    role: row.role,
    sharedAt: new Date(row.shared_at),
    ownerName: row.owner_name,
  }));
};

export type SharedItem = Awaited<ReturnType<typeof listSharedWithMe>>[number];
